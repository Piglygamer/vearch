import { Router, Request, Response } from "express";
import { requireAuth } from "../_core/auth";
import {
  issueToken,
  reprovisionToken,
  scanAndReprovisionExpiringTokens,
  issueCard,
  getUserCards,
  isCardValid,
  processPayment,
  daysUntilExpiration,
  getTokenStatus,
  formatExpiryDate,
} from "../services/paymentService";
import {
  createImplant,
  getImplantsByUserId,
  getImplantById,
  getTokensByImplantId,
  getActiveTokenByImplantId,
  createWallet,
  getWalletsByUserId,
  createTransaction,
  getTransactionsByUserId,
} from "../db";
import { InsertImplant, InsertWallet, InsertTransaction } from "../../drizzle/schema";

const router = Router();

// ============================================================================
// IMPLANT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/payment/implants
 * Link a new implant to the user's account
 */
router.post("/implants", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const { implantId, implantType, nxtpayTokenId } = req.body;

    if (!implantId || !implantType) {
      return res.status(400).json({ error: "Missing required fields: implantId, implantType" });
    }

    // Create implant record
    const implantData: InsertImplant = {
      userId,
      implantId,
      implantType,
      nxtpayTokenId: nxtpayTokenId || null,
      status: "active",
      expiresAt: implantType === "NxtPay" ? new Date("2028-12-31") : undefined,
    };

    const implant = await createImplant(implantData);

    // Issue initial tokens
    const nxtpayToken = await issueToken(implant.id, "nxtpay");
    const vearchToken = await issueToken(implant.id, "vearch");

    res.json({
      success: true,
      implant: {
        id: implant.id,
        implantId: implant.implantId,
        implantType: implant.implantType,
        status: implant.status,
        linkedAt: implant.linkedAt,
      },
      tokens: {
        nxtpay: {
          id: nxtpayToken.id,
          expiresAt: nxtpayToken.expiresAt,
          status: getTokenStatus(nxtpayToken.expiresAt),
          daysUntilExpiration: daysUntilExpiration(nxtpayToken.expiresAt),
        },
        vearch: {
          id: vearchToken.id,
          expiresAt: vearchToken.expiresAt,
          status: getTokenStatus(vearchToken.expiresAt),
          daysUntilExpiration: daysUntilExpiration(vearchToken.expiresAt),
        },
      },
    });
  } catch (error) {
    console.error("[Payment API] Implant creation error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payment/implants
 * Get all implants for the user
 */
router.get("/implants", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const userImplants = await getImplantsByUserId(userId);

    const implantDetails = await Promise.all(
      userImplants.map(async (implant) => {
        const tokens = await getTokensByImplantId(implant.id);
        const activeToken = await getActiveTokenByImplantId(implant.id);

        return {
          id: implant.id,
          implantId: implant.implantId,
          implantType: implant.implantType,
          status: implant.status,
          linkedAt: implant.linkedAt,
          expiresAt: implant.expiresAt,
          tokenCount: tokens.length,
          activeToken: activeToken
            ? {
                id: activeToken.id,
                type: activeToken.tokenType,
                expiresAt: activeToken.expiresAt,
                status: getTokenStatus(activeToken.expiresAt),
                daysUntilExpiration: daysUntilExpiration(activeToken.expiresAt),
              }
            : null,
        };
      })
    );

    res.json({ success: true, implants: implantDetails });
  } catch (error) {
    console.error("[Payment API] Implant retrieval error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payment/implants/:implantId/tokens
 * Get all tokens for a specific implant
 */
router.get("/implants/:implantId/tokens", async (req: Request, res: Response) => {
  try {
    const implantId = parseInt(req.params.implantId);
    const tokens = await getTokensByImplantId(implantId);

    const tokenDetails = tokens.map((token) => ({
      id: token.id,
      type: token.tokenType,
      status: getTokenStatus(token.expiresAt),
      expiresAt: token.expiresAt,
      issuedAt: token.issuedAt,
      daysUntilExpiration: daysUntilExpiration(token.expiresAt),
      reprovisionedAt: token.reprovisionedAt,
    }));

    res.json({ success: true, tokens: tokenDetails });
  } catch (error) {
    console.error("[Payment API] Token retrieval error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// TOKEN RE-PROVISIONING ENDPOINTS
// ============================================================================

/**
 * POST /api/payment/implants/:implantId/reprovision
 * Manually trigger token re-provisioning for an implant
 */
router.post("/implants/:implantId/reprovision", async (req: Request, res: Response) => {
  try {
    const implantId = parseInt(req.params.implantId);
    const result = await reprovisionToken(implantId);

    res.json({
      success: true,
      message: "Token re-provisioning completed",
      result,
    });
  } catch (error) {
    console.error("[Payment API] Re-provisioning error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/payment/scan-and-reprovision
 * Scan for expiring tokens and trigger re-provisioning (admin only)
 */
router.post("/scan-and-reprovision", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const results = await scanAndReprovisionExpiringTokens();

    res.json({
      success: true,
      message: "Scan and re-provisioning completed",
      results,
    });
  } catch (error) {
    console.error("[Payment API] Scan error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// CARD MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/payment/cards
 * Issue a new virtual EMV card
 */
router.post("/cards", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const { implantId, cardholderName } = req.body;

    const card = await issueCard(userId, implantId, cardholderName);

    res.json({
      success: true,
      card: {
        id: card.id,
        cardToken: card.cardToken,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        expiryFormatted: formatExpiryDate(card.expiryMonth, card.expiryYear),
        cardholderName: card.cardholderName,
        status: card.status,
        issuedAt: card.issuedAt,
        maskedCardNumber: `****${card.cardNumber.slice(-4)}`,
      },
    });
  } catch (error) {
    console.error("[Payment API] Card issuance error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payment/cards
 * Get all cards for the user
 */
router.get("/cards", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const cards = await getUserCards(userId);

    res.json({ success: true, cards });
  } catch (error) {
    console.error("[Payment API] Card retrieval error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// WALLET MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/payment/wallets
 * Link a new funding source (wallet)
 */
router.post("/wallets", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const { walletType, fundingSourceId, balance, currency } = req.body;

    if (!walletType || !fundingSourceId) {
      return res.status(400).json({ error: "Missing required fields: walletType, fundingSourceId" });
    }

    const walletData: InsertWallet = {
      userId,
      walletType: walletType as any,
      fundingSourceId,
      balance: balance || "0.00",
      currency: currency || "USD",
      status: "active",
    };

    const wallet = await createWallet(walletData);

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        walletType: wallet.walletType,
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status,
        linkedAt: wallet.linkedAt,
      },
    });
  } catch (error) {
    console.error("[Payment API] Wallet creation error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payment/wallets
 * Get all wallets for the user
 */
router.get("/wallets", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const wallets = await getWalletsByUserId(userId);

    const walletDetails = wallets.map((wallet) => ({
      id: wallet.id,
      walletType: wallet.walletType,
      balance: wallet.balance,
      currency: wallet.currency,
      status: wallet.status,
      linkedAt: wallet.linkedAt,
      lastVerifiedAt: wallet.lastVerifiedAt,
    }));

    res.json({ success: true, wallets: walletDetails });
  } catch (error) {
    console.error("[Payment API] Wallet retrieval error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// TRANSACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/payment/transactions
 * Create a new transaction (payment)
 */
router.post("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const { cardId, walletId, amount, merchantName, description, transactionType } = req.body;

    if (!amount || !merchantName) {
      return res.status(400).json({ error: "Missing required fields: amount, merchantName" });
    }

    const transactionData: InsertTransaction = {
      userId,
      cardId: cardId || undefined,
      walletId: walletId || undefined,
      transactionType: transactionType || "payment",
      amount: amount.toString(),
      currency: "USD",
      status: "pending",
      merchantName,
      description: description || null,
    };

    const transaction = await createTransaction(transactionData);

    // Simulate payment processing
    const paymentResult = await processPayment(cardId, amount, merchantName, description);

    res.json({
      success: paymentResult.success,
      transaction: {
        id: transaction.id,
        transactionId: paymentResult.transactionId,
        amount: transaction.amount,
        merchantName: transaction.merchantName,
        status: paymentResult.status,
        timestamp: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("[Payment API] Transaction error:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/payment/transactions
 * Get transaction history for the user
 */
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1; // Demo: default to user 1
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await getTransactionsByUserId(userId, limit);

    const transactionDetails = transactions.map((txn) => ({
      id: txn.id,
      type: txn.transactionType,
      amount: txn.amount,
      currency: txn.currency,
      merchantName: txn.merchantName,
      status: txn.status,
      createdAt: txn.createdAt,
    }));

    res.json({ success: true, transactions: transactionDetails });
  } catch (error) {
    console.error("[Payment API] Transaction retrieval error:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
