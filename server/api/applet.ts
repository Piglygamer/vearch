import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { transactions, implants, wallets, InsertTransaction } from "../../drizzle/schema";
import { getAccountBalance } from "../services/stripeService";
import { getUserBankAccount } from "../services/bankService";
import { eq, gte, and } from "drizzle-orm";
import crypto from "crypto";
import Stripe from "stripe";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Helper: Get user ID from implant ID
 */
async function getUserIdFromImplantId(implantId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const implantRecord = await db
    .select()
    .from(implants)
    .where(eq(implants.implantId, implantId))
    .limit(1);

  if (!implantRecord || implantRecord.length === 0) return null;
  return implantRecord[0].userId;
}

/**
 * Helper: Get implant DB ID from implant ID string
 */
async function getImplantDbId(implantId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const implantRecord = await db
    .select()
    .from(implants)
    .where(eq(implants.implantId, implantId))
    .limit(1);

  if (!implantRecord || implantRecord.length === 0) return null;
  return implantRecord[0].id;
}

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

    // Look up user by implantId
    const userId = await getUserIdFromImplantId(implantId);
    if (!userId) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Implant not found",
      });
    }

    // Get user's wallet
    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        authorized: false,
        declineReason: "Database unavailable",
      });
    }

    const walletRecord = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!walletRecord || walletRecord.length === 0) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Wallet not found",
      });
    }

    const wallet = walletRecord[0];
    const walletBalance = parseFloat(wallet.balance.toString());

    // Check balance
    if (walletBalance < amount) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Insufficient funds",
      });
    }

    // Get today's transactions for this user
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, today)));

    const dailyTotal = todayTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    if (dailyTotal + amount > 5000) {
      return res.status(400).json({
        authorized: false,
        declineReason: "Daily limit exceeded",
      });
    }

    // Generate authorization code
    const authCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const implantDbId = await getImplantDbId(implantId);

    // Store pending transaction
    await db.insert(transactions).values({
      userId,
      implantId: implantDbId || undefined,
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

    // Find pending transaction by metadata
    const allTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.status, "pending" as any));

    const txn = allTxns.find((t) => {
      try {
        const meta = JSON.parse(t.metadata || "{}");
        return meta.transactionId === transactionId && meta.authCode === authCode;
      } catch {
        return false;
      }
    });

    if (!txn) {
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

    // Process charge: deduct from wallet
    if (txn.walletId) {
      const walletRecord = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, txn.walletId))
        .limit(1);

      if (walletRecord && walletRecord.length > 0) {
        const currentBalance = parseFloat(walletRecord[0].balance.toString());
        const txnAmount = parseFloat(txn.amount.toString());
        const newBalance = (currentBalance - txnAmount).toFixed(2);

        await db
          .update(wallets)
          .set({ balance: newBalance })
          .where(eq(wallets.id, txn.walletId));
      }
    }

    // Generate settlement ID
    const settlementId = `SETTLE_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    // Update transaction status
    await db
      .update(transactions)
      .set({
        status: "completed",
        updatedAt: new Date(),
        metadata: JSON.stringify({
          ...JSON.parse(txn.metadata || "{}"),
          settlementId,
          cryptogram,
        }),
      })
      .where(eq(transactions.id, txn.id));

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

    // Look up user by implantId
    const userId = await getUserIdFromImplantId(implantId);
    if (!userId) {
      return res.status(400).json({
        error: "Implant not found",
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        error: "Database unavailable",
      });
    }

    // Get wallet
    const walletRecord = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!walletRecord || walletRecord.length === 0) {
      return res.status(400).json({
        error: "Wallet not found",
      });
    }

    const balance = parseFloat(walletRecord[0].balance.toString());

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

    // Look up user by implantId
    const userId = await getUserIdFromImplantId(implantId);
    if (!userId) {
      return res.status(400).json({
        error: "Implant not found",
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        error: "Database unavailable",
      });
    }

    const recentTxns = (await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .limit(limit)) as any;

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

    // Look up user by implantId
    const userId = await getUserIdFromImplantId(implantId);
    if (!userId) {
      return res.status(400).json({
        allowed: false,
        reason: "Implant not found",
      });
    }

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyTxns = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, today)));

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
