import Stripe from "stripe";
import { Request, Response } from "express";
import {
  detachPaymentMethodByStripeId,
  getDb,
  getTransactionByStripePaymentIntentId,
  updateTransactionByStripePaymentIntentId,
  upsertPaymentMethod,
  createTransaction,
} from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Lazy Stripe client. Avoid throwing at module import time when
 * STRIPE_SECRET_KEY is unset (tests, local dev without webhooks).
 */
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("[Stripe Webhook] STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

/**
 * Verify a webhook signature and return the parsed event, or null if the
 * signature is invalid. Exported for testing.
 */
export function verifyStripeSignature(rawBody: Buffer | string, signature: string, secret: string): Stripe.Event | null {
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/**
 * Handle Stripe webhook events
 * Must be registered with express.raw({ type: 'application/json' }) BEFORE express.json()
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  if (!sig) {
    console.error("[Stripe Webhook] Missing signature header");
    return res.status(400).json({ error: "Missing signature" });
  }
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event: Stripe.Event;
  try {
    // Verify webhook signature
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle test events (for Stripe dashboard testing)
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected:", event.type);
    return res.json({ verified: true });
  }

  try {
    await processStripeEvent(event);
    return res.json({ verified: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    // Still return 200 to acknowledge receipt
    return res.json({ verified: true, error: "Processing error" });
  }
}

/**
 * Dispatch a verified Stripe event to its handler. Exported so tests can
 * drive event handling without re-running signature verification.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // ----- Subscriptions (legacy paths, kept) -----
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.paid":
    case "invoice.payment_failed":
      console.log(`[Stripe Webhook] ${event.type}`);
      break;

    // ----- Middleman bridge: PaymentIntent lifecycle -----
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const existing = await getTransactionByStripePaymentIntentId(pi.id);
      if (existing) {
        await updateTransactionByStripePaymentIntentId(pi.id, { status: "completed" });
      } else {
        // Edge case: webhook arrived before our local insert (or insert failed).
        const userId = parseInt((pi.metadata?.vearchUserId ?? "0") as string, 10);
        if (userId > 0) {
          await createTransaction({
            userId,
            transactionType: "payment",
            amount: (pi.amount / 100).toFixed(2),
            currency: pi.currency.toUpperCase(),
            status: "completed",
            description: `Charge via implant ${(pi.metadata?.vearchImplantUid ?? "").slice(0, 8)}…`,
            stripePaymentIntentId: pi.id,
            metadata: JSON.stringify({ source: "webhook" }),
          }).catch((e) => console.error("[Stripe Webhook] insert failed:", e));
        }
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await updateTransactionByStripePaymentIntentId(pi.id, {
        status: "failed",
        metadata: JSON.stringify({
          declineCode: pi.last_payment_error?.decline_code ?? null,
          message: pi.last_payment_error?.message ?? null,
        }),
      });
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (piId) {
        await updateTransactionByStripePaymentIntentId(piId, { status: "reversed" });
      }
      break;
    }

    // ----- Middleman bridge: PaymentMethod sync -----
    case "payment_method.attached": {
      const pm = event.data.object as Stripe.PaymentMethod;
      const customerId = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
      if (!customerId) break;
      const userId = await lookupUserIdByStripeCustomer(customerId);
      if (userId) {
        await upsertPaymentMethod({
          userId,
          stripePaymentMethodId: pm.id,
          brand: pm.card?.brand ?? null,
          last4: pm.card?.last4 ?? null,
          expMonth: pm.card?.exp_month ?? null,
          expYear: pm.card?.exp_year ?? null,
        });
      }
      break;
    }
    case "payment_method.detached": {
      const pm = event.data.object as Stripe.PaymentMethod;
      await detachPaymentMethodByStripeId(pm.id);
      break;
    }

    default:
      console.log("[Stripe Webhook] Unhandled event type:", event.type);
  }
}

async function lookupUserIdByStripeCustomer(customerId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return rows.length > 0 ? rows[0].id : null;
}
