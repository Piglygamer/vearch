/**
 * Crypto Payment API
 * Public endpoints for cryptocurrency deposits/withdrawals
 * Uses CoinGecko API (free, no authentication required)
 */

import { Router, Request, Response } from "express";
import { cryptoPaymentService } from "../services/cryptoPaymentService";
import { getDb } from "../db";
import { wallets, transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * GET /api/crypto/prices
 * Get real-time cryptocurrency prices
 */
router.get("/prices", async (req: Request, res: Response) => {
  try {
    const cryptos = (req.query.cryptos as string)?.split(",") || [
      "bitcoin",
      "ethereum",
    ];
    const prices = await cryptoPaymentService.getCryptoPrices(cryptos);
    res.json({ success: true, prices });
  } catch (error) {
    console.error("[Crypto API] Price fetch failed:", error);
    res.status(500).json({ success: false, error: "Failed to fetch prices" });
  }
});

/**
 * GET /api/crypto/market/:cryptoId
 * Get detailed market data for a cryptocurrency
 */
router.get("/market/:cryptoId", async (req: Request, res: Response) => {
  try {
    const { cryptoId } = req.params;
    const marketData = await cryptoPaymentService.getCryptoMarketData(cryptoId);
    res.json({ success: true, marketData });
  } catch (error) {
    console.error("[Crypto API] Market data fetch failed:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch market data" });
  }
});

/**
 * GET /api/crypto/supported
 * List all supported cryptocurrencies
 */
router.get("/supported", async (req: Request, res: Response) => {
  try {
    const cryptos = await cryptoPaymentService.listSupportedCryptos();
    res.json({ success: true, cryptos });
  } catch (error) {
    console.error("[Crypto API] Supported cryptos fetch failed:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch supported cryptos" });
  }
});

/**
 * POST /api/crypto/deposit
 * Process cryptocurrency deposit
 */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { cryptoType, amount } = req.body;

    if (!cryptoType || !amount || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid crypto type or amount" });
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
        walletType: "crypto",
        fundingSourceId: `crypto_wallet_${userId}`,
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

    // Process crypto deposit
    const cryptoTx = await cryptoPaymentService.processCryptoDeposit(
      userId,
      cryptoType,
      amount
    );

    // Update wallet balance
    const currentBalance = parseFloat(wallet[0].balance || "0");
    const newBalance = (currentBalance + cryptoTx.usdValue).toFixed(2);

    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet[0].id));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "topup",
      amount: cryptoTx.usdValue.toString(),
      currency: "USD",
      status: "completed",
      description: `Crypto deposit: ${amount} ${cryptoType.toUpperCase()} = $${cryptoTx.usdValue.toFixed(2)}`,
      externalTransactionId: cryptoTx.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: cryptoTx.id,
      crypto: cryptoType,
      amount,
      usdValue: cryptoTx.usdValue,
      newBalance,
      message: `Deposited ${amount} ${cryptoType.toUpperCase()} ($${cryptoTx.usdValue.toFixed(2)})`,
    });
  } catch (error) {
    console.error("[Crypto API] Deposit failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Deposit failed",
    });
  }
});

/**
 * POST /api/crypto/withdraw
 * Process cryptocurrency withdrawal
 */
router.post("/withdraw", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { cryptoType, usdAmount } = req.body;

    if (!cryptoType || !usdAmount || usdAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid crypto type or amount" });
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
    if (currentBalance < usdAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Process crypto withdrawal
    const cryptoTx = await cryptoPaymentService.processCryptoWithdrawal(
      userId,
      cryptoType,
      usdAmount
    );

    // Update wallet balance
    const newBalance = (currentBalance - usdAmount).toFixed(2);

    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet[0].id));

    // Log transaction
    await db.insert(transactions).values({
      userId,
      walletId: wallet[0].id as any,
      transactionType: "withdrawal",
      amount: usdAmount.toString(),
      currency: "USD",
      status: "completed",
      description: `Crypto withdrawal: $${usdAmount.toFixed(2)} = ${cryptoTx.amount.toFixed(8)} ${cryptoType.toUpperCase()}`,
      externalTransactionId: cryptoTx.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    res.json({
      success: true,
      transactionId: cryptoTx.id,
      crypto: cryptoType,
      cryptoAmount: cryptoTx.amount,
      usdAmount,
      newBalance,
      message: `Withdrew $${usdAmount.toFixed(2)} as ${cryptoTx.amount.toFixed(8)} ${cryptoType.toUpperCase()}`,
    });
  } catch (error) {
    console.error("[Crypto API] Withdrawal failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Withdrawal failed",
    });
  }
});

export default router;
