import { Router, Request, Response } from "express";
import { verifyWebhookSignature, handleWebhookEvent } from "../services/stripeService";

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

  // Get raw body for signature verification
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  try {
    const event = verifyWebhookSignature(rawBody, signature);

    if (!event) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    // Handle the event
    await handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
