import Stripe from "stripe";
import { Request, Response } from "express";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * Handle Stripe webhook events
 * Must be registered with express.raw({ type: 'application/json' }) BEFORE express.json()
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    console.error("[Stripe Webhook] Missing signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body, // Raw body buffer
      sig,
      webhookSecret
    );
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
    // Process events
    switch (event.type) {
      case "customer.subscription.created":
        console.log("[Stripe Webhook] Subscription created:", event.data.object);
        break;

      case "customer.subscription.updated":
        console.log("[Stripe Webhook] Subscription updated:", event.data.object);
        break;

      case "customer.subscription.deleted":
        console.log("[Stripe Webhook] Subscription deleted:", event.data.object);
        break;

      case "invoice.paid":
        console.log("[Stripe Webhook] Invoice paid:", event.data.object);
        break;

      case "invoice.payment_failed":
        console.log("[Stripe Webhook] Invoice payment failed:", event.data.object);
        break;

      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
    }

    // Always return 200 OK
    return res.json({ verified: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    // Still return 200 to acknowledge receipt
    return res.json({ verified: true, error: "Processing error" });
  }
}
