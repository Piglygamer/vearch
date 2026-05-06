/**
 * Middleman bridge: Stripe Customer + PaymentMethod operations.
 *
 * The user's saved cards live on a Stripe Customer (`cus_…`); each saved
 * card is a PaymentMethod (`pm_…`). The PAN never touches our servers — the
 * frontend collects it via Stripe Elements driven by a SetupIntent client
 * secret, and Stripe attaches the resulting `pm_…` to the customer. We
 * mirror the public metadata into our `paymentMethods` table via webhook.
 */

import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb, getUserById, listPaymentMethodsByUserId, upsertPaymentMethod, detachPaymentMethodByStripeId, setDefaultPaymentMethod as setDefaultPmInDb, getPaymentMethodByStripeId } from "../db";
import { users } from "../../drizzle/schema";
import { getStripe } from "./stripeClient";

/**
 * Get the Stripe Customer for a Vearch user, creating one if missing and
 * persisting the id back to `users.stripeCustomerId`.
 */
export async function getOrCreateCustomer(userId: number, stripe: Stripe = getStripe()): Promise<string> {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { vearchUserId: String(userId) },
  });

  const db = await getDb();
  if (db) {
    await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
  }
  return customer.id;
}

/**
 * Create a SetupIntent the frontend can confirm with Stripe Elements to
 * attach a new card to the user's Stripe Customer.
 */
export async function createSetupIntent(userId: number, stripe: Stripe = getStripe()): Promise<{ clientSecret: string; customerId: string }> {
  const customerId = await getOrCreateCustomer(userId, stripe);
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
  });
  if (!intent.client_secret) {
    throw new Error("Stripe did not return a SetupIntent client_secret");
  }
  return { clientSecret: intent.client_secret, customerId };
}

/** List the saved PaymentMethods for a user (from our local mirror). */
export async function listPaymentMethods(userId: number) {
  return listPaymentMethodsByUserId(userId);
}

/** Detach a PaymentMethod from the user's Stripe Customer. */
export async function detachPaymentMethod(
  userId: number,
  stripePaymentMethodId: string,
  stripe: Stripe = getStripe()
): Promise<void> {
  // Authorization: ensure the PM belongs to this user before touching Stripe.
  const owned = await getPaymentMethodByStripeId(stripePaymentMethodId);
  if (!owned || owned.userId !== userId) {
    throw new Error("Payment method not found");
  }
  await stripe.paymentMethods.detach(stripePaymentMethodId);
  await detachPaymentMethodByStripeId(stripePaymentMethodId);
}

/** Mark a saved PaymentMethod as the user's default for off-session charges. */
export async function setDefaultPaymentMethod(userId: number, paymentMethodDbId: number): Promise<void> {
  await setDefaultPmInDb(userId, paymentMethodDbId);
}

/**
 * Mirror a Stripe PaymentMethod into our local table. Called by the webhook
 * handler on `payment_method.attached`.
 */
export async function syncPaymentMethodFromStripe(pm: Stripe.PaymentMethod, userId: number): Promise<void> {
  await upsertPaymentMethod({
    userId,
    stripePaymentMethodId: pm.id,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
  });
}
