import { Router, Request, Response } from "express";
import {
  createBankAccount,
  getUserBankAccount,
  updateBankAccountStatus,
  getUserBalance,
  isUserOnboarded,
} from "../services/bankService";
import { getDb } from "../db";
import { wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/bank/account/create
 * Create a bank account for the user
 */
router.post("/account/create", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Missing required fields: email, name" });
    }

    const { stripeAccountId, onboardingUrl } = await createBankAccount(userId, email, name);

    res.json({
      success: true,
      stripeAccountId,
      onboardingUrl,
      message: "Bank account created successfully.",
    });
  } catch (error) {
    console.error("[Bank API] Failed to create account:", error);
    res.status(500).json({ error: "Failed to create bank account" });
  }
});

/**
 * GET /api/bank/account
 * Get user's bank account details
 */
router.get("/account", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;

    const account = await getUserBankAccount(userId);

    if (!account) {
      return res.json({
        success: true,
        account: null,
        message: "No bank account found. Create one to get started.",
      });
    }

    res.json({
      success: true,
      account: {
        id: account.stripeAccountId,
        status: account.status,
        chargesEnabled: true,
        payoutsEnabled: true,
      },
    });
  } catch (error) {
    console.error("[Bank API] Failed to get account:", error);
    res.status(500).json({ error: "Failed to get bank account" });
  }
});

/**
 * GET /api/bank/balance
 * Get user's account balance
 */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.json({ success: true, balance: 0, currency: "USD" });
    }

    // Get balance from wallet instead of Stripe
    const userBalance = await getUserBalance(userId);

    res.json({
      success: true,
      balance: userBalance,
      currency: "USD",
      formattedBalance: `$${userBalance.toFixed(2)}`,
    });
  } catch (error) {
    console.error("[Bank API] Failed to get balance:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

/**
 * POST /api/bank/deposit
 * Deposit money into the account
 */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, paymentMethodId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get or create wallet
    let wallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    
    if (wallet.length === 0) {
      return res.status(400).json({ error: "Wallet not found. Create one first." });
    }

    const newBalance = parseFloat(wallet[0].balance.toString()) + amount;
    
    // Update wallet balance
    await db.update(wallets).set({ balance: newBalance.toString() as any }).where(eq(wallets.userId, userId));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "topup",
      amount: amount.toString(),
      currency: "USD",
      status: "completed",
      description: `Deposit of $${amount}`,
      createdAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: `dep_${Date.now()}`,
      status: "completed",
      amount,
      newBalance,
      message: `Deposit of $${amount} completed successfully.`,
    });
  } catch (error) {
    console.error("[Bank API] Error during deposit:", error);
    res.status(500).json({ error: "Failed to process deposit" });
  }
});

/**
 * POST /api/bank/withdraw
 * Withdraw money from the account
 */
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, bankAccountId } = req.body;

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

    const newBalance = currentBalance - amount;
    
    // Update wallet balance
    await db.update(wallets).set({ balance: newBalance.toString() as any }).where(eq(wallets.userId, userId));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "payment",
      amount: amount.toString(),
      currency: "USD",
      status: "pending",
      description: `Withdrawal of $${amount}`,
      createdAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: `wth_${Date.now()}`,
      status: "pending",
      amount,
      newBalance,
      message: `Withdrawal of $${amount} initiated. Status: pending`,
    });
  } catch (error) {
    console.error("[Bank API] Failed to process withdrawal:", error);
    res.status(500).json({ error: "Failed to process withdrawal" });
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

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    res.json({
      success: true,
      transactions: userTransactions,
    });
  } catch (error) {
    console.error("[Bank API] Failed to get transactions:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

export default router;
