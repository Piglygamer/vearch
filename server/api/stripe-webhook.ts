import { Router, Request, Response } from "express";

const router = Router();

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  try {
    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const event = req.body;

    // Log webhook event
    console.log(`[Webhook] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        console.log(`[Webhook] Payment succeeded: ${event.data.object.id}`);
        break;

      case "payment_intent.payment_failed":
        console.log(`[Webhook] Payment failed: ${event.data.object.id}`);
        break;

      case "charge.dispute.created":
        console.log(`[Webhook] Dispute created: ${event.data.object.id}`);
        break;

      case "account.updated":
        console.log(`[Webhook] Account updated: ${event.data.object.id}`);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
