import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { transactions, InsertTransaction } from "../../drizzle/schema";
import { getAccountBalance } from "../services/stripeService";
import { getUserBankAccount } from "../services/bankService";
import { eq, gte, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

/**
 * POST /api/applet/authorize
 * Authorize a transaction from the Apex Flex EMV applet
 */
router.post("/authorize", async (req: Request, res: Response) => {
  try {
    const { transactionId, amount, merchantId, implantId, timestamp } = req.body;

    if (!transactionId || !amount || !merchantId || !implantId) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Missing required fields",
      });
    }

    // Validate transaction amount (prevent abuse)
    if (amount <= 0 || amount > 500) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Transaction amount exceeds limit",
      });
    }

    // Validate timestamp (prevent replay attacks)
    const now = Date.now() / 1000;
    if (Math.abs(now - timestamp) > 300) {
      // 5 minute window
      return res.status(400).json({
        authorized: false,
        declineReason: "Transaction timestamp invalid",
      });
    }

    // TODO: Look up user by implantId
    const userId = 1; // Demo user

    // Get user's bank account
    const bankAccount = await getUserBankAccount(userId);
    if (!bankAccount) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Bank account not found",
      });
    }

    // Check balance
    const balance = await getAccountBalance(bankAccount.stripeAccountId);
    if (balance < amount) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Insufficient funds",
      });
    }

    // Check daily velocity
    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        authorized: false,
        declineReason: "Database unavailable",
      });
    }

    // Get today's transactions for this implant
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await db
      .select()
      .from(transactions)
      .where(gte(transactions.createdAt, today));

    const dailyTotal = todayTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    if (dailyTotal + amount > 5000) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Daily limit exceeded",
      });
    }

    // Generate authorization code
    const authCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    // Store pending transaction
    await db.insert(transactions).values({
      userId,
      implantId: 1, // TODO: Map implantId to DB ID
      transactionType: "payment",
      amount: amount.toString(),
      currency: "USD",
      status: "pending",
      merchantName: merchantId,
      description: `Apex Flex NFC Payment - ${transactionId}`,
      metadata: JSON.stringify({
        transactionId,
        merchantId,
        implantId,
        authCode,
        timestamp,
      }),
    } as InsertTransaction);

    res.json({
      authorized: true,
      authCode,
    });
  } catch (error) {
    console.error("[Applet] Authorization error:", error);
    res.status(500).json({
      authorized: false,
      declineReason: "Authorization failed",
    });
  }
});

/**
 * POST /api/applet/confirm
 * Confirm transaction completion and process settlement
 */
router.post("/confirm", async (req: Request, res: Response) => {
  try {
    const { transactionId, cryptogram, authCode } = req.body;

    if (!transactionId || !cryptogram || !authCode) {
      return res.status(400).json({
        confirmed: false,
        error: "Missing required fields",
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        confirmed: false,
        error: "Database unavailable",
      });
    }

    // Find pending transaction
    const txn = await db
      .select()
      .from(transactions)
      .where(eq(transactions.status, "pending" as any));

    if (txn.length === 0) {
      return res.status(400).json({
        confirmed: false,
        error: "Transaction not found",
      });
    }

    // Verify cryptogram (in production, verify RSA signature)
    // For now, just check that it's present
    if (!cryptogram || cryptogram.length < 32) {
      return res.status(400).json({
        confirmed: false,
        error: "Invalid cryptogram",
      });
    }

    // TODO: Process charge via Stripe
    const userId = txn[0].userId;
    const amount = parseFloat(txn[0].amount.toString());

    // Generate settlement ID
    const settlementId = `SETTLE_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    // Update transaction status
    await db
      .update(transactions)
      .set({
        status: "completed",
        metadata: JSON.stringify({
          ...JSON.parse(txn[0].metadata || "{}"),
          settlementId,
          cryptogram,
        }),
      })
      .where(eq(transactions.id, txn[0].id));

    res.json({
      confirmed: true,
      settlementId,
    });
  } catch (error) {
    console.error("[Applet] Confirmation error:", error);
    res.status(500).json({
      confirmed: false,
      error: "Confirmation failed",
    });
  }
});

/**
 * POST /api/applet/update
 * Check for and provide applet updates
 */
router.post("/update", async (req: Request, res: Response) => {
  try {
    const { implantId, currentVersion } = req.body;

    if (!implantId || !currentVersion) {
      return res.status(400).json({
        updateAvailable: false,
      });
    }

    // Current applet version
    const LATEST_VERSION = "1.2.0";

    if (currentVersion === LATEST_VERSION) {
      return res.json({
        updateAvailable: false,
      });
    }

    // In production, serve actual applet binary
    // For now, return update metadata
    const appletUrl = "/api/applet/download/VearchEMV_1.2.0.cap";
    const checksum = crypto.createHash("sha256").update(LATEST_VERSION).digest("hex");

    res.json({
      updateAvailable: true,
      newVersion: LATEST_VERSION,
      appletUrl,
      checksum,
      releaseNotes: "Security updates and improved transaction handling",
    });
  } catch (error) {
    console.error("[Applet] Update check error:", error);
    res.status(500).json({
      updateAvailable: false,
      error: "Update check failed",
    });
  }
});

/**
 * GET /api/applet/balance
 * Get wallet balance for applet
 */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const implantId = req.query.implantId as string;

    if (!implantId) {
      return res.status(400).json({
        error: "Missing implantId",
      });
    }

    // TODO: Look up user by implantId
    const userId = 1; // Demo user

    const bankAccount = await getUserBankAccount(userId);
    if (!bankAccount) {
      return res.status(400).json({
        error: "Bank account not found",
      });
    }

    const balance = await getAccountBalance(bankAccount.stripeAccountId);

    res.json({
      balance,
      currency: "USD",
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error("[Applet] Balance query error:", error);
    res.status(500).json({
      error: "Balance query failed",
    });
  }
});

/**
 * GET /api/applet/transactions
 * Get recent transactions for applet (for display on implant)
 */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const implantId = req.query.implantId as string;
    const limit = parseInt(req.query.limit as string) || 5;

    if (!implantId) {
      return res.status(400).json({
        error: "Missing implantId",
      });
    }

    // TODO: Look up user by implantId
    const userId = 1; // Demo user

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        error: "Database unavailable",
      });
    }

    const recentTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .limit(limit) as any;

    res.json({
      transactions: recentTxns.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        merchantName: t.merchantName,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Applet] Transaction query error:", error);
    res.status(500).json({
      error: "Transaction query failed",
    });
  }
});

/**
 * POST /api/applet/velocity-check
 * Check transaction velocity limits
 */
router.post("/velocity-check", async (req: Request, res: Response) => {
  try {
    const { implantId, amount } = req.body;

    if (!implantId || !amount) {
      return res.status(400).json({
        allowed: false,
        reason: "Missing required fields",
      });
    }

    // TODO: Look up user by implantId
    const userId = 1; // Demo user

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        allowed: false,
        reason: "Database unavailable",
      });
    }

    // Check hourly limit (10 transactions per hour)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const hourlyTxns = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, oneHourAgo)));

    if (hourlyTxns.length >= 10) {
      return res.json({
        allowed: false,
        reason: "Hourly transaction limit exceeded",
      });
    }

    // Check daily limit ($5,000)
    const today2 = new Date();
    today2.setHours(0, 0, 0, 0);
    const dailyTxns = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, today2)));

    const dailyTotal = dailyTxns.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    if (dailyTotal + amount > 5000) {
      return res.json({
        allowed: false,
        reason: "Daily limit would be exceeded",
        currentDaily: dailyTotal,
        limit: 5000,
      });
    }

    // Check per-transaction limit ($500)
    if (amount > 500) {
      return res.json({
        allowed: false,
        reason: "Transaction amount exceeds limit",
        limit: 500,
      });
    }

    res.json({
      allowed: true,
      currentDaily: dailyTotal,
      remainingDaily: 5000 - dailyTotal,
      hourlyCount: hourlyTxns.length,
      remainingHourly: 10 - hourlyTxns.length,
    });
  } catch (error) {
    console.error("[Applet] Velocity check error:", error);
    res.status(500).json({
      allowed: false,
      reason: "Velocity check failed",
    });
  }
});

export default router;
