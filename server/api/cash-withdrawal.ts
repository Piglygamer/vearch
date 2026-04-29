/**
 * Cash Withdrawal API
 * Generate QR codes for cash withdrawals at retail locations
 */

import { Router, Request, Response } from "express";
import { cashWithdrawalService } from "../services/cashWithdrawalService";
import { getDb } from "../db";
import { wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/cash-withdrawal/create
 * Create a cash withdrawal code
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { amount, expirationMinutes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
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

    // Create withdrawal code
    const withdrawalCode = await cashWithdrawalService.createCashWithdrawalCode(
      userId,
      amount,
      expirationMinutes || 60
    );

    // Deduct from wallet (hold the funds)
    const newBalance = (currentBalance - amount).toFixed(2);
    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet[0].id));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "cash_withdrawal",
      amount: amount.toString(),
      currency: "USD",
      status: "pending",
      description: `Cash withdrawal code: ${withdrawalCode.code}`,
      externalTransactionId: withdrawalCode.code,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    res.json({
      success: true,
      code: withdrawalCode.code,
      qrCode: withdrawalCode.qrCode,
      amount: withdrawalCode.amount,
      expiresAt: withdrawalCode.expiresAt,
      retailLocations: withdrawalCode.retailLocations,
      instructions: withdrawalCode.instructions,
      claimCode: withdrawalCode.claimCode,
      newBalance,
      message: `Cash withdrawal code generated. Show this at any retail location to withdraw $${amount}`,
    });
  } catch (error) {
    console.error("[Cash Withdrawal] Creation failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create withdrawal code",
    });
  }
});

/**
 * GET /api/cash-withdrawal/status/:code
 * Check withdrawal code status
 */
router.get("/status/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const status = await cashWithdrawalService.getWithdrawalStatus(code);

    if (!status) {
      return res.status(404).json({ error: "Code not found" });
    }

    res.json({
      success: true,
      code: status.code,
      amount: status.amount,
      status: status.status,
      createdAt: status.createdAt,
      expiresAt: status.expiresAt,
      claimedAt: status.claimedAt,
      claimedLocation: status.claimedLocation,
    });
  } catch (error) {
    console.error("[Cash Withdrawal] Status check failed:", error);
    res.status(500).json({ success: false, error: "Failed to check status" });
  }
});

/**
 * POST /api/cash-withdrawal/claim
 * Claim a withdrawal code at a retail location (retailer side)
 */
router.post("/claim", async (req: Request, res: Response) => {
  try {
    const { code, location } = req.body;

    if (!code || !location) {
      return res.status(400).json({ error: "Code and location required" });
    }

    const result = await cashWithdrawalService.claimWithdrawalCode(code, location);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      amount: result.amount,
      message: result.message,
      code,
      location,
    });
  } catch (error) {
    console.error("[Cash Withdrawal] Claim failed:", error);
    res.status(500).json({ success: false, error: "Failed to claim withdrawal" });
  }
});

/**
 * GET /api/cash-withdrawal/my-codes
 * Get all withdrawal codes for current user
 */
router.get("/my-codes", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const codes = await cashWithdrawalService.getUserWithdrawalCodes(userId);

    res.json({
      success: true,
      codes: codes.map((c) => ({
        code: c.code,
        amount: c.amount,
        status: c.status,
        createdAt: c.createdAt,
        expiresAt: c.expiresAt,
        claimedAt: c.claimedAt,
        claimedLocation: c.claimedLocation,
      })),
    });
  } catch (error) {
    console.error("[Cash Withdrawal] Fetch codes failed:", error);
    res.status(500).json({ success: false, error: "Failed to fetch codes" });
  }
});

/**
 * POST /api/cash-withdrawal/cancel/:code
 * Cancel a withdrawal code
 */
router.post("/cancel/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const userId = (req as any).user?.id || 1;

    // Verify code belongs to user
    const status = await cashWithdrawalService.getWithdrawalStatus(code);
    if (!status || status.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const cancelled = await cashWithdrawalService.cancelWithdrawalCode(code);

    if (!cancelled) {
      return res.status(400).json({ error: "Cannot cancel this code" });
    }

    // Refund to wallet
    const db = await getDb();
    if (db) {
      const wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      if (wallet.length > 0) {
        const currentBalance = parseFloat(wallet[0].balance || "0");
        const newBalance = (currentBalance + status.amount).toFixed(2);

        await db
          .update(wallets)
          .set({ balance: newBalance })
          .where(eq(wallets.id, wallet[0].id));

        // Log refund
        await db.insert(transactions).values({
          userId,
          walletId: wallet[0].id as any,
          transactionType: "refund",
          amount: status.amount.toString(),
          currency: "USD",
          status: "completed",
          description: `Refund for cancelled withdrawal code: ${code}`,
          externalTransactionId: `refund_${code}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
    }

    res.json({
      success: true,
      message: `Withdrawal code ${code} cancelled and $${status.amount} refunded`,
      refundedAmount: status.amount,
    });
  } catch (error) {
    console.error("[Cash Withdrawal] Cancellation failed:", error);
    res.status(500).json({ success: false, error: "Failed to cancel withdrawal" });
  }
});

/**
 * GET /api/cash-withdrawal/stats
 * Get withdrawal statistics (admin)
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await cashWithdrawalService.getWithdrawalStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("[Cash Withdrawal] Stats failed:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

export default router;
