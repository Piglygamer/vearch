/**
 * Multi-Payment API
 * Unified endpoint for all payment methods
 */

import { Router, Request, Response } from "express";
import { multiPaymentService } from "../services/multiPaymentService";
import { getDb } from "../db";
import { wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * GET /api/multi-payment/methods
 * Get all available payment methods
 */
router.get("/methods", async (req: Request, res: Response) => {
  try {
    const methods = await multiPaymentService.getAvailableMethods();
    res.json({ success: true, methods });
  } catch (error) {
    console.error("[Multi-Payment] Methods fetch failed:", error);
    res.status(500).json({ success: false, error: "Failed to fetch methods" });
  }
});

/**
 * POST /api/multi-payment/deposit
 * Process deposit with any payment method
 */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { method, amount, details } = req.body;

    if (!method || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid method or amount" });
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get or create wallet
    let wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (wallet.length === 0) {
      await db.insert(wallets).values({
        userId,
        walletType: "multi",
        fundingSourceId: `wallet_${userId}`,
        balance: "0.00",
        currency: "USD",
        status: "active",
        linkedAt: new Date(),
        expiryDate: null,
      } as any);

      wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);
    }

    // Process payment
    const paymentResult = await multiPaymentService.processPayment(method, amount, {
      ...details,
      userId,
    });

    // Update wallet balance
    const currentBalance = parseFloat(wallet[0].balance || "0");
    const newBalance = (currentBalance + paymentResult.usdValue).toFixed(2);

    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet[0].id));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "topup",
      amount: paymentResult.usdValue.toString(),
      currency: "USD",
      status: paymentResult.status === "completed" ? "completed" : "pending",
      description: `${method} deposit: $${paymentResult.usdValue.toFixed(2)}`,
      externalTransactionId: paymentResult.transactionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      method,
      amount: paymentResult.amount,
      usdValue: paymentResult.usdValue,
      newBalance,
      status: paymentResult.status,
      details: paymentResult.details,
    });
  } catch (error) {
    console.error("[Multi-Payment] Deposit failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Deposit failed",
    });
  }
});

/**
 * POST /api/multi-payment/withdraw
 * Process withdrawal with any payment method
 */
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { method, amount, details } = req.body;

    if (!method || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid method or amount" });
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get wallet
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (wallet.length === 0) {
      return res.status(400).json({ error: "Wallet not found" });
    }

    const currentBalance = parseFloat(wallet[0].balance || "0");
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Process withdrawal
    const paymentResult = await multiPaymentService.processPayment(method, amount, {
      ...details,
      userId,
    });

    // Update wallet balance
    const newBalance = (currentBalance - amount).toFixed(2);

    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet[0].id));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "withdrawal",
      amount: amount.toString(),
      currency: "USD",
      status: paymentResult.status === "completed" ? "completed" : "pending",
      description: `${method} withdrawal: $${amount.toFixed(2)}`,
      externalTransactionId: paymentResult.transactionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      method,
      amount,
      newBalance,
      status: paymentResult.status,
      details: paymentResult.details,
    });
  } catch (error) {
    console.error("[Multi-Payment] Withdrawal failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Withdrawal failed",
    });
  }
});

export default router;
