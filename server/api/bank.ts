import { Router, Request, Response } from "express";
import {
  createBankAccount,
  getUserBankAccount,
  updateBankAccountStatus,
  getUserBalance,
  isUserOnboarded,
} from "../services/bankService";
import { processDeposit, processWithdrawal, getAccountBalance } from "../services/stripeService";

const router = Router();

/**
 * POST /api/bank/account/create
 * Create a bank account for the user (Stripe onboarding)
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
      message: "Bank account created. Complete Stripe onboarding to enable payments.",
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
        id: account.id,
        stripeAccountId: account.stripeAccountId,
        status: account.status,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        balance: account.balance,
        createdAt: account.createdAt,
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

    const balance = await getAccountBalance(account.stripeAccountId);

    res.json({
      success: true,
      balance,
      currency: "USD",
      formattedBalance: `$${balance.toFixed(2)}`,
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

    if (!amount || !paymentMethodId) {
      return res.status(400).json({ error: "Missing required fields: amount, paymentMethodId" });
    }

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.status(400).json({ error: "Bank account not found. Create one first." });
    }

    const result = await processDeposit(account.stripeAccountId, paymentMethodId, amount);

    res.json({
      success: true,
      transactionId: result.transactionId,
      status: result.status,
      amount: result.amount,
      message: `Deposit of $${amount} initiated. Status: ${result.status}`,
    });
  } catch (error) {
    console.error("[Bank API] Failed to process deposit:", error);
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

    if (!amount || !bankAccountId) {
      return res.status(400).json({ error: "Missing required fields: amount, bankAccountId" });
    }

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.status(400).json({ error: "Bank account not found. Create one first." });
    }

    const result = await processWithdrawal(account.stripeAccountId, bankAccountId, amount);

    res.json({
      success: true,
      transactionId: result.transactionId,
      status: result.status,
      amount: result.amount,
      message: `Withdrawal of $${amount} initiated. Status: ${result.status}`,
    });
  } catch (error) {
    console.error("[Bank API] Failed to process withdrawal:", error);
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

/**
 * GET /api/bank/onboarding-status
 * Check if user has completed Stripe onboarding
 */
router.get("/onboarding-status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;

    const isOnboarded = await isUserOnboarded(userId);
    const account = await getUserBankAccount(userId);

    res.json({
      success: true,
      isOnboarded,
      status: account?.status || "not_created",
      chargesEnabled: account?.chargesEnabled || false,
      payoutsEnabled: account?.payoutsEnabled || false,
    });
  } catch (error) {
    console.error("[Bank API] Failed to check onboarding status:", error);
    res.status(500).json({ error: "Failed to check onboarding status" });
  }
});

export default router;
