import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { implants, wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/payments/authorize
 * Authorize a payment from Apex Flex EMV applet
 */
router.post("/authorize", async (req: Request, res: Response) => {
  try {
    const { implantId, amount, currency, merchantId, transactionId } = req.body;

    if (!implantId || !amount || !currency || !merchantId || !transactionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Validate implant exists and get user
    const implantRecord = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (!implantRecord || implantRecord.length === 0) {
      return res.status(404).json({ error: "Implant not found" });
    }

    const implant = implantRecord[0];
    const userId = implant.userId;

    // Get user's wallet
    const userWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!userWallet || userWallet.length === 0) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const wallet = userWallet[0];

    // Check balance
    const walletBalance = parseFloat(wallet.balance.toString());
    if (walletBalance < amount) {
      return res.status(400).json({
        error: "Insufficient balance",
        required: amount,
        available: walletBalance,
      });
    }

    // Generate authorization code
    const authCode = `AUTH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create pending transaction record
    const txnId = Math.floor(Math.random() * 1000000);
    await db.insert(transactions).values({
      userId,
      walletId: wallet.id,
      implantId: implant.id,
      transactionType: "payment",
      amount: amount.toString(),
      currency,
      status: "pending",
      description: `Implant payment at ${merchantId}`,
      metadata: JSON.stringify({
        implantId,
        merchantId,
        authCode,
        externalTransactionId: transactionId,
      }),
      createdAt: new Date(),
    });

    // Return authorization
    res.json({
      success: true,
      authCode,
      status: "approved",
      transactionId: txnId,
      amount,
      currency,
      balance: walletBalance - amount,
      message: `Payment of ${currency} ${amount} authorized`,
    });
  } catch (error) {
    console.error("[Payments API] Authorization failed:", error);
    res.status(500).json({ error: "Payment authorization failed" });
  }
});

/**
 * POST /api/payments/confirm
 * Confirm transaction completion and process Stripe charge
 */
router.post("/confirm", async (req: Request, res: Response) => {
  try {
    const { transactionId, status } = req.body;

    if (!transactionId || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Get transaction
    const txnRecord = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!txnRecord || txnRecord.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const txn = txnRecord[0];

    if (status === "completed") {
      // Deduct from wallet balance
      if (!txn.walletId) {
        return res.status(400).json({ error: "Transaction has no wallet" });
      }

      const wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, txn.walletId))
        .limit(1);

      if (wallet && wallet.length > 0) {
        const currentBalance = parseFloat(wallet[0].balance.toString());
        const txnAmount = parseFloat(txn.amount.toString());
        const newBalance = (currentBalance - txnAmount).toFixed(2);
        
        await db
          .update(wallets)
          .set({ balance: newBalance })
          .where(eq(wallets.id, txn.walletId));
      }

      // Update transaction status
      await db
        .update(transactions)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));

      res.json({
        success: true,
        transactionId,
        status: "completed",
        amount: txn.amount,
        message: "Transaction completed successfully",
      });
    } else if (status === "failed") {
      // Update transaction status to failed
      await db
        .update(transactions)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));

      res.json({
        success: true,
        transactionId,
        status: "failed",
        message: "Transaction marked as failed",
      });
    } else if (status === "reversed") {
      // Update transaction status to reversed
      await db
        .update(transactions)
        .set({ status: "reversed", updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));

      res.json({
        success: true,
        transactionId,
        status: "reversed",
        message: "Transaction reversed",
      });
    } else {
      return res.status(400).json({ error: "Invalid status" });
    }
  } catch (error) {
    console.error("[Payments API] Confirmation failed:", error);
    res.status(500).json({ error: "Payment confirmation failed" });
  }
});

/**
 * GET /api/payments/balance
 * Get current balance for implant
 */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const implantId = req.query.implantId as string;

    if (!implantId) {
      return res.status(400).json({ error: "Missing implant ID" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Get implant
    const implantRecord = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (!implantRecord || implantRecord.length === 0) {
      return res.status(404).json({ error: "Implant not found" });
    }

    const implant = implantRecord[0];

    // Get wallet
    const walletRecord = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, implant.userId))
      .limit(1);

    if (!walletRecord || walletRecord.length === 0) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const wallet = walletRecord[0];

    res.json({
      success: true,
      implantId,
      userId: implant.userId,
      balance: parseFloat(wallet.balance.toString()),
      currency: wallet.currency,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("[Payments API] Failed to get balance:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

/**
 * POST /api/payments/refund
 * Refund a transaction
 */
router.post("/refund", async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "Missing transaction ID" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Get transaction
    const txnRecord = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!txnRecord || txnRecord.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const txn = txnRecord[0];

    if (txn.status !== "completed") {
      return res.status(400).json({ error: "Only completed transactions can be refunded" });
    }

    // Refund: add amount back to wallet
    if (!txn.walletId) {
      return res.status(400).json({ error: "Transaction has no wallet" });
    }

    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, txn.walletId))
      .limit(1);

    if (wallet && wallet.length > 0) {
      const currentBalance = parseFloat(wallet[0].balance.toString());
      const txnAmount = parseFloat(txn.amount.toString());
      const newBalance = (currentBalance + txnAmount).toFixed(2);
      
      await db
        .update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, txn.walletId));
    }

    // Create refund transaction record
    const refundTxnId = Math.floor(Math.random() * 1000000);
    await db.insert(transactions).values({
      userId: txn.userId,
      walletId: txn.walletId,
      transactionType: "refund",
      amount: txn.amount,
      currency: txn.currency,
      status: "completed",
      description: `Refund for transaction ${transactionId}`,
      metadata: JSON.stringify({
        originalTransactionId: transactionId,
      }),
      createdAt: new Date(),
    });

    // Update original transaction status
    await db
      .update(transactions)
      .set({ status: "reversed", updatedAt: new Date() })
      .where(eq(transactions.id, transactionId));

    res.json({
      success: true,
      transactionId,
      refundTransactionId: refundTxnId,
      refundAmount: txn.amount,
      message: "Transaction refunded successfully",
    });
  } catch (error) {
    console.error("[Payments API] Refund failed:", error);
    res.status(500).json({ error: "Refund failed" });
  }
});

/**
 * GET /api/payments/history
 * Get payment history for implant
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const implantId = req.query.implantId as string;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!implantId) {
      return res.status(400).json({ error: "Missing implant ID" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Get implant
    const implantRecord = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (!implantRecord || implantRecord.length === 0) {
      return res.status(404).json({ error: "Implant not found" });
    }

    const implant = implantRecord[0];

    // Get transaction history
    const txnHistory = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, implant.userId))
      .limit(limit);

    res.json({
      success: true,
      implantId,
      transactions: txnHistory,
      count: txnHistory.length,
    });
  } catch (error) {
    console.error("[Payments API] Failed to get history:", error);
    res.status(500).json({ error: "Failed to get payment history" });
  }
});

export default router;
