import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { processPayment, getAvailableProviders, PaymentProvider } from "../services/unifiedPaymentService";

const router = Router();

/**
 * POST /api/bank/deposit
 * Deposit money into the account
 */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, provider = "paypal" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Auto-create wallet if missing
    let wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

    if (wallet.length === 0) {
      console.log(`[Bank] Creating wallet for user ${userId}`);
      await db.insert(wallets).values({
        userId,
        walletType: "prepaid",
        fundingSourceId: `wallet_${userId}`,
        balance: "0.00",
        currency: "USD",
      });

      wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    }

    // Process payment with selected provider
    const paymentResult = await processPayment({
      provider: provider as PaymentProvider,
      amount,
      currency: "USD",
      userId,
      walletId: wallet[0].id,
      description: `Deposit to Vearch Bank - User ${userId}`,
    });

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.error || "Payment processing failed" });
    }

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "topup",
      amount: amount.toString(),
      currency: "USD",
      status: paymentResult.status,
      description: `${provider.toUpperCase()} deposit of $${amount}`,
      externalId: paymentResult.transactionId,
      createdAt: new Date(),
    } as any);

    // If payment is completed, update wallet immediately
    if (paymentResult.status === "completed") {
      const newBalance = parseFloat(wallet[0].balance.toString()) + amount;
      await db.update(wallets).set({ balance: newBalance.toString() as any }).where(eq(wallets.userId, userId));
    }

    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      provider: paymentResult.provider,
      status: paymentResult.status,
      amount,
      redirectUrl: paymentResult.redirectUrl,
      message: paymentResult.redirectUrl
        ? `Redirecting to ${provider} to complete deposit of $${amount}`
        : `Deposit of $${amount} via ${provider} completed successfully`,
    });
  } catch (error) {
    console.error("[Bank API] Deposit failed:", error);
    res.status(500).json({ error: "Deposit failed" });
  }
});

/**
 * POST /api/bank/withdraw
 * Withdraw money from the account
 */
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, provider = "paypal" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid withdrawal amount" });
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get wallet
    const wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

    if (wallet.length === 0) {
      return res.status(400).json({ error: "Wallet not found" });
    }

    const currentBalance = parseFloat(wallet[0].balance.toString());

    if (currentBalance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Process withdrawal with selected provider
    const paymentResult = await processPayment({
      provider: provider as PaymentProvider,
      amount,
      currency: "USD",
      userId,
      walletId: wallet[0].id,
      description: `Withdrawal from Vearch Bank - User ${userId}`,
    });

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.error || "Withdrawal processing failed" });
    }

    // Deduct from wallet
    const newBalance = currentBalance - amount;
    await db.update(wallets).set({ balance: newBalance.toString() as any }).where(eq(wallets.userId, userId));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "withdrawal",
      amount: amount.toString(),
      currency: "USD",
      status: paymentResult.status,
      description: `${provider.toUpperCase()} withdrawal of $${amount}`,
      externalId: paymentResult.transactionId,
      createdAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      provider: paymentResult.provider,
      status: paymentResult.status,
      amount,
      newBalance,
      message: `Withdrawal of $${amount} via ${provider} completed successfully`,
    });
  } catch (error) {
    console.error("[Bank API] Withdrawal failed:", error);
    res.status(500).json({ error: "Withdrawal failed" });
  }
});

/**
 * GET /api/bank/balance
 * Get user's account balance
 */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Auto-create wallet if missing
    let wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

    if (wallet.length === 0) {
      console.log(`[Bank] Creating wallet for user ${userId}`);
      await db.insert(wallets).values({
        userId,
        walletType: "prepaid",
        fundingSourceId: `wallet_${userId}`,
        balance: "0.00",
        currency: "USD",
      });

      wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    }

    const balance = parseFloat(wallet[0].balance.toString());

    res.json({
      success: true,
      balance,
      currency: "USD",
      formattedBalance: `$${balance.toFixed(2)}`,
    });
  } catch (error) {
    console.error("[Bank API] Get balance failed:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

/**
 * GET /api/bank/transactions
 * Get user's transaction history
 */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));

    res.json({
      success: true,
      transactions: userTransactions.map((t: any) => ({
        id: t.id,
        type: t.transactionType,
        amount: parseFloat(t.amount as string),
        currency: t.currency,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Bank API] Get transactions failed:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

/**
 * GET /api/bank/payment-providers
 * Get available payment providers
 */
router.get("/payment-providers", async (req: Request, res: Response) => {
  try {
    const providers = getAvailableProviders();

    res.json({
      success: true,
      providers,
      message: `${providers.length} payment provider(s) available`,
    });
  } catch (error) {
    console.error("[Bank API] Get providers failed:", error);
    res.status(500).json({ error: "Failed to get payment providers" });
  }
});

export default router;
