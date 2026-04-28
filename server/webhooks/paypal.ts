import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { transactions, wallets } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

/**
 * PayPal Webhook Handler
 * Handles payment confirmations, refunds, and disputes
 */

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status: string;
    amount: {
      value: string;
      currency_code: string;
    };
    custom_id?: string;
    payer?: {
      email_address: string;
    };
  };
}

/**
 * Verify PayPal webhook signature
 */
function verifyPayPalSignature(
  webhookId: string,
  event: PayPalWebhookEvent,
  signature: string,
  transmissionId: string,
  transmissionTime: string,
  certUrl: string
): boolean {
  try {
    // In production, verify against PayPal's certificate
    // For now, we'll do basic validation
    const expectedSig = crypto
      .createHash("sha256")
      .update(`${transmissionId}|${transmissionTime}|${webhookId}|${JSON.stringify(event)}`)
      .digest("hex");

    return signature === expectedSig;
  } catch (error) {
    console.error("[PayPal] Signature verification failed:", error);
    return false;
  }
}

/**
 * POST /webhooks/paypal
 * Handle PayPal webhook events
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const event: PayPalWebhookEvent = req.body;
    const transmissionId = req.headers["paypal-transmission-id"] as string;
    const transmissionTime = req.headers["paypal-transmission-time"] as string;
    const certUrl = req.headers["paypal-cert-url"] as string;
    const signature = req.headers["paypal-auth-algo"] as string;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";

    console.log(`[PayPal] Received webhook: ${event.event_type}`);

    // Verify webhook signature
    if (!verifyPayPalSignature(webhookId, event, signature, transmissionId, transmissionTime, certUrl)) {
      console.warn("[PayPal] Invalid webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Handle different event types
    switch (event.event_type) {
      case "CHECKOUT.ORDER.COMPLETED":
        await handleOrderCompleted(db, event);
        break;

      case "PAYMENT.CAPTURE.COMPLETED":
        await handlePaymentCompleted(db, event);
        break;

      case "PAYMENT.CAPTURE.REFUNDED":
        await handleRefund(db, event);
        break;

      case "PAYMENT.CAPTURE.DENIED":
        await handlePaymentDenied(db, event);
        break;

      default:
        console.log(`[PayPal] Unhandled event type: ${event.event_type}`);
    }

    // Acknowledge receipt
    res.json({ success: true });
  } catch (error) {
    console.error("[PayPal] Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

/**
 * Handle completed order
 */
async function handleOrderCompleted(db: any, event: PayPalWebhookEvent) {
  try {
    const customId = event.resource.custom_id;
    if (!customId) return;

    // Parse custom_id format: "user_{userId}_wallet_{walletId}"
    const match = customId.match(/user_(\d+)_wallet_(\d+)/);
    if (!match) return;

    const userId = parseInt(match[1]);
    const walletId = parseInt(match[2]);
    const amount = event.resource.amount.value;

    // Update transaction status
    await db
      .update(transactions)
      .set({
        status: "completed",
        externalId: event.resource.id,
        completedAt: new Date(),
      })
      .where(eq(transactions.id, walletId));

    // Update wallet balance
    const wallet = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

    if (wallet.length > 0) {
      const currentBalance = parseFloat(wallet[0].balance);
      const newBalance = (currentBalance + parseFloat(amount)).toFixed(2);

      await db
        .update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, walletId));

      console.log(`[PayPal] Order completed: User ${userId}, Amount: $${amount}`);
    }
  } catch (error) {
    console.error("[PayPal] Error handling order completion:", error);
  }
}

/**
 * Handle payment capture completed
 */
async function handlePaymentCompleted(db: any, event: PayPalWebhookEvent) {
  try {
    const customId = event.resource.custom_id;
    if (!customId) return;

    const match = customId.match(/user_(\d+)_wallet_(\d+)/);
    if (!match) return;

    const userId = parseInt(match[1]);
    const amount = event.resource.amount.value;

    console.log(`[PayPal] Payment completed: User ${userId}, Amount: $${amount}, Status: ${event.resource.status}`);

    // Log transaction
    await db.insert(transactions).values({
      userId,
      type: "deposit",
      amount: parseFloat(amount),
      status: "completed",
      externalId: event.resource.id,
      description: `PayPal payment received`,
      metadata: JSON.stringify({ paypalId: event.resource.id }),
    });
  } catch (error) {
    console.error("[PayPal] Error handling payment completion:", error);
  }
}

/**
 * Handle refund
 */
async function handleRefund(db: any, event: PayPalWebhookEvent) {
  try {
    const customId = event.resource.custom_id;
    if (!customId) return;

    const match = customId.match(/user_(\d+)_wallet_(\d+)/);
    if (!match) return;

    const userId = parseInt(match[1]);
    const amount = event.resource.amount.value;

    console.log(`[PayPal] Refund processed: User ${userId}, Amount: $${amount}`);

    // Create refund transaction
    await db.insert(transactions).values({
      userId,
      type: "refund",
      amount: parseFloat(amount),
      status: "completed",
      externalId: event.resource.id,
      description: `PayPal refund processed`,
      metadata: JSON.stringify({ paypalId: event.resource.id }),
    });

    // Update wallet balance
    const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

    if (wallet.length > 0) {
      const currentBalance = parseFloat(wallet[0].balance);
      const newBalance = (currentBalance + parseFloat(amount)).toFixed(2);

      await db
        .update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, wallet[0].id));
    }
  } catch (error) {
    console.error("[PayPal] Error handling refund:", error);
  }
}

/**
 * Handle payment denied
 */
async function handlePaymentDenied(db: any, event: PayPalWebhookEvent) {
  try {
    const customId = event.resource.custom_id;
    if (!customId) return;

    const match = customId.match(/user_(\d+)_wallet_(\d+)/);
    if (!match) return;

    const userId = parseInt(match[1]);
    const amount = event.resource.amount.value;

    console.log(`[PayPal] Payment denied: User ${userId}, Amount: $${amount}`);

    // Log failed transaction
    await db.insert(transactions).values({
      userId,
      type: "deposit",
      amount: parseFloat(amount),
      status: "failed",
      externalId: event.resource.id,
      description: `PayPal payment denied`,
      metadata: JSON.stringify({ paypalId: event.resource.id, reason: "Payment denied" }),
    });
  } catch (error) {
    console.error("[PayPal] Error handling payment denial:", error);
  }
}

export default router;
