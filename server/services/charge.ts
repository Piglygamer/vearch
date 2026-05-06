/**
 * Middleman bridge: charge a user's default Stripe PaymentMethod off-session
 * after a merchant terminal scans the implant UID.
 *
 * Money flow: cardholder card -> Stripe -> merchant's connected account.
 * Vearch never holds funds. See LEGAL.md.
 */

import type Stripe from "stripe";
import { resolveImplant } from "./implantLink";
import { getStripe } from "./stripeClient";
import { getDb, createTransaction } from "../db";
import { transactions, implants } from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";

export type ChargeResult =
  | {
      approved: true;
      paymentIntentId: string;
      amountCents: number;
      currency: string;
    }
  | {
      approved: false;
      declineCode: ChargeDeclineCode;
      message: string;
      paymentIntentId?: string;
    };

export type ChargeDeclineCode =
  | "unknown_implant"
  | "no_payment_method"
  | "rate_limited"
  | "authentication_required"
  | "card_declined"
  | "processing_error"
  | "configuration_error";

export interface ChargeInput {
  uid: string;
  amountCents: number;
  currency?: string; // defaults to "usd"
  merchantId: number;
  merchantStripeAccountId: string;
  /** Optional idempotency key. Stripe will dedupe duplicate POSTs from a flaky terminal. */
  idempotencyKey?: string;
  /** Per-implant rate-limit window in seconds; default 5s. */
  rateLimitSeconds?: number;
}

/**
 * Per-implant rate limit: refuse if a transaction was created against the
 * same implant within the configured window. Cheap protection against a
 * stuck terminal hammering the endpoint or a malicious double-tap.
 */
async function isRateLimited(implantDbId: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const since = new Date(Date.now() - windowSeconds * 1000);
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.implantId, implantDbId), gte(transactions.createdAt, since)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Charge the implant owner's default saved PaymentMethod off-session. The
 * merchant's connected Stripe account receives the funds via
 * `transfer_data.destination`.
 */
export async function chargeByImplantUid(input: ChargeInput, stripe: Stripe = getStripe()): Promise<ChargeResult> {
  const currency = (input.currency ?? "usd").toLowerCase();
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { approved: false, declineCode: "processing_error", message: "amountCents must be a positive integer" };
  }

  const resolved = await resolveImplant(input.uid);
  if (!resolved) {
    // Don't leak whether the UID was unknown or had no PM on file.
    return { approved: false, declineCode: "unknown_implant", message: "Unknown implant or no payment method on file" };
  }

  // Rate limit per implant (lookup the db id first).
  const db = await getDb();
  let implantDbId: number | undefined;
  if (db) {
    const rows = await db.select({ id: implants.id }).from(implants).where(eq(implants.userId, resolved.userId)).limit(1);
    implantDbId = rows[0]?.id;
    if (implantDbId && (await isRateLimited(implantDbId, input.rateLimitSeconds ?? 5))) {
      return { approved: false, declineCode: "rate_limited", message: "Implant tapped too recently; try again in a few seconds" };
    }
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency,
        customer: resolved.stripeCustomerId,
        payment_method: resolved.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        transfer_data: { destination: input.merchantStripeAccountId },
        metadata: {
          vearchUserId: String(resolved.userId),
          vearchMerchantId: String(input.merchantId),
          vearchImplantUid: input.uid,
        },
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    );
  } catch (err) {
    return mapStripeError(err);
  }

  // Persist the transaction row regardless of webhook delivery.
  await createTransaction({
    userId: resolved.userId,
    implantId: implantDbId ?? null,
    transactionType: "payment",
    amount: (input.amountCents / 100).toFixed(2),
    currency: currency.toUpperCase(),
    status: intent.status === "succeeded" ? "completed" : "pending",
    description: `Charge via implant ${input.uid.slice(0, 8)}…`,
    stripePaymentIntentId: intent.id,
    metadata: JSON.stringify({ merchantId: input.merchantId, intentStatus: intent.status }),
  }).catch((e) => {
    // Don't fail the charge if local logging fails — the webhook will reconcile.
    console.error("[charge] Failed to log transaction:", e);
  });

  if (intent.status === "succeeded") {
    return { approved: true, paymentIntentId: intent.id, amountCents: input.amountCents, currency };
  }
  if (intent.status === "requires_action" || intent.status === "requires_confirmation") {
    return {
      approved: false,
      declineCode: "authentication_required",
      message: "Cardholder must confirm this payment in the Vearch app",
      paymentIntentId: intent.id,
    };
  }
  return {
    approved: false,
    declineCode: "card_declined",
    message: `PaymentIntent status: ${intent.status}`,
    paymentIntentId: intent.id,
  };
}

/** Translate a thrown Stripe error into a stable ChargeResult shape. */
export function mapStripeError(err: unknown): ChargeResult {
  // Stripe errors expose `.type`, `.code`, `.raw.payment_intent`.
  const e = err as { type?: string; code?: string; message?: string; raw?: { payment_intent?: { id?: string } } };
  const piId = e?.raw?.payment_intent?.id;

  if (e?.code === "authentication_required") {
    return {
      approved: false,
      declineCode: "authentication_required",
      message: "Cardholder must confirm this payment in the Vearch app",
      paymentIntentId: piId,
    };
  }
  if (e?.type === "StripeCardError" || e?.code === "card_declined") {
    return {
      approved: false,
      declineCode: "card_declined",
      message: e.message ?? "Card was declined",
      paymentIntentId: piId,
    };
  }
  if (e?.type === "StripeInvalidRequestError") {
    return {
      approved: false,
      declineCode: "configuration_error",
      message: e.message ?? "Invalid request to Stripe",
    };
  }
  return {
    approved: false,
    declineCode: "processing_error",
    message: e?.message ?? "Unknown error contacting payment processor",
  };
}
