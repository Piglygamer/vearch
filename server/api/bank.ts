import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { processDeposit, processWithdrawal, checkPaymentStatus, UnifiedDepositRequest, UnifiedWithdrawalRequest } from "../services/unifiedPaymentService";

const router = Router();

/**
 * POST /api/bank/deposit
 * Deposit money into the account via crypto or bank transfer
 */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, method = "crypto", cryptoCurrency, bankAccount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    if (!method || !["crypto", "ach", "wire"].includes(method)) {
      return res.status(400).json({ error: "Invalid payment method (must be crypto, ach, or wire)" });
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

    // Process deposit with unified payment service
    const depositRequest: UnifiedDepositRequest = {
      userId,
      amount,
      method: method as "crypto" | "ach" | "wire",
      cryptoCurrency: cryptoCurrency as "BTC" | "ETH" | "SOL" | "USDC" | "USDT" | undefined,
      bankAccount,
    };

    const paymentResult = await processDeposit(depositRequest);

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.message });
    }

    // Log transaction
    const transactionStatus = paymentResult.status === "processing" ? "pending" : paymentResult.status;
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id,
      transactionType: "topup",
      amount: amount.toString(),
      currency: "USD",
      status: transactionStatus as "pending" | "completed" | "failed",
      description: paymentResult.message,
      metadata: JSON.stringify({
        transactionId: paymentResult.transactionId,
        method: paymentResult.method,
        details: paymentResult.details,
      }),
    });

    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      method: paymentResult.method,
      status: paymentResult.status,
      amount,
      message: paymentResult.message,
      estimatedCompletion: paymentResult.estimatedCompletion,
      details: paymentResult.details,
    });
  } catch (error) {
    console.error("[Bank API] Deposit failed:", error);
    res.status(500).json({ error: "Deposit failed" });
  }
});

/**
 * POST /api/bank/withdraw
 * Withdraw money from the account via crypto or bank transfer
 */
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, method = "crypto", destinationAddress, destinationBank, beneficiaryBank } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid withdrawal amount" });
    }

    if (!method || !["crypto", "ach", "wire"].includes(method)) {
      return res.status(400).json({ error: "Invalid payment method (must be crypto, ach, or wire)" });
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

    // Process withdrawal with unified payment service
    const withdrawalRequest: UnifiedWithdrawalRequest = {
      userId,
      amount,
      method: method as "crypto" | "ach" | "wire",
      destinationAddress,
      destinationBank,
      beneficiaryBank,
    };

    const paymentResult = await processWithdrawal(withdrawalRequest);

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.message });
    }

    // Log transaction (balance will be deducted by the payment engine)
    const withdrawalStatus = paymentResult.status === "processing" ? "pending" : paymentResult.status;
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id,
      transactionType: "transfer",
      amount: amount.toString(),
      currency: "USD",
      status: withdrawalStatus as "pending" | "completed" | "failed",
      description: paymentResult.message,
      metadata: JSON.stringify({
        transactionId: paymentResult.transactionId,
        method: paymentResult.method,
        details: paymentResult.details,
      }),
    });

    const newBalance = currentBalance - amount;

    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      method: paymentResult.method,
      status: paymentResult.status,
      amount,
      newBalance,
      message: paymentResult.message,
      estimatedCompletion: paymentResult.estimatedCompletion,
      details: paymentResult.details,
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
 * GET /api/bank/account
 * Get user's full account information
 */
router.get("/account", async (req: Request, res: Response) => {
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
    const userTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));

    res.json({
      success: true,
      account: {
        userId,
        wallet: {
          id: wallet[0].id,
          type: wallet[0].walletType,
          balance,
          currency: wallet[0].currency,
          status: wallet[0].status,
        },
        transactions: userTransactions.map((t: any) => ({
          id: t.id,
          type: t.transactionType,
          amount: parseFloat(t.amount as string),
          currency: t.currency,
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
        })),
        paymentMethods: ["crypto", "ach", "wire"],
      },
    });
  } catch (error) {
    console.error("[Bank API] Get account failed:", error);
    res.status(500).json({ error: "Failed to get account information" });
  }
});

/**
 * GET /api/bank/payment-methods
 * Get available payment methods
 */
router.get("/payment-methods", async (req: Request, res: Response) => {
  try {
    const methods = [
      {
        id: "crypto",
        name: "Cryptocurrency",
        currencies: ["BTC", "ETH", "SOL", "USDC", "USDT"],
        estimatedTime: "10-30 minutes",
        description: "Deposit or withdraw via blockchain",
      },
      {
        id: "ach",
        name: "ACH Transfer",
        estimatedTime: "2-3 business days",
        description: "Automated Clearing House transfer",
      },
      {
        id: "wire",
        name: "Wire Transfer",
        estimatedTime: "Same day or next business day",
        description: "International wire transfer",
      },
    ];

    res.json({
      success: true,
      methods,
      message: `${methods.length} payment method(s) available`,
    });
  } catch (error) {
    console.error("[Bank API] Get methods failed:", error);
    res.status(500).json({ error: "Failed to get payment methods" });
  }
});

/**
 * GET /api/bank/status/:transactionId
 * Check transaction status
 */
router.get("/status/:transactionId", async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const status = await checkPaymentStatus(transactionId);

    res.json({
      success: status.found,
      transactionId,
      status: status.status,
      message: status.message,
    });
  } catch (error) {
    console.error("[Bank API] Check status failed:", error);
    res.status(500).json({ error: "Failed to check transaction status" });
  }
});

export default router;
