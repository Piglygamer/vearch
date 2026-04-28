import { Router, Request, Response } from "express";
import {
  createBankAccount,
  getUserBankAccount,
  updateBankAccountStatus,
  getUserBalance,
  isUserOnboarded,
} from "../services/bankService";

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

    if (!amount || !paymentMethodId) {
      return res.status(400).json({ error: "Missing required fields: amount, paymentMethodId" });
    }

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.status(400).json({ error: "Bank account not found. Create one first." });
    }

    if (!account.chargesEnabled) {
      return res.status(400).json({ error: "Your account is not ready to accept payments. Complete Stripe onboarding." });
    }

    try {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
      
      // Create a charge using the payment method
      const charge = await stripe.charges.create(
        {
          amount: Math.round(amount * 100),
          currency: "usd",
          payment_method: paymentMethodId,
          confirm: true,
          return_url: "https://vbank.manus.space",
        },
        { stripeAccount: account.stripeAccountId }
      );

      res.json({
        success: true,
        transactionId: charge.id,
        status: charge.status,
        amount: charge.amount / 100,
        message: `Deposit of ${amount} completed successfully.`,
      });
    } catch (stripeError: any) {
      console.error("[Bank API] Stripe error during deposit:", stripeError);
      res.status(500).json({ 
        error: "Failed to process deposit",
        details: stripeError.message || "Unknown Stripe error"
      });
    }
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

    // Process withdrawal (mock for now)
    res.json({
      success: true,
      transactionId: `payout_${Date.now()}`,
      status: "pending",
      amount,
      message: `Withdrawal of $${amount} initiated. Status: pending`,
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
