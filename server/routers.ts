import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { paymentRouter } from "./routers/paymentRouter";
import { paymentEmulatorRouter } from "./routers/paymentEmulator";
import { microchipRouter } from "./routers/microchipRouter";
import { paymentMethodsRouter } from "./routers/paymentMethodsRouter";
import { implantsBridgeRouter } from "./routers/implantsBridgeRouter";
import { transactionsBridgeRouter } from "./routers/transactionsBridgeRouter";
import { merchantRouter } from "./routers/merchantRouter";
import { fidesmoRouter } from "./routers/fidesmoRouter";
import {
  getWalletsByUserId,
  getTransactionsByUserId,
  getImplantsByUserId,
  getCardsByUserId,
  createImplant,
  getDb,
} from "./db";
import { wallets, transactions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  processDeposit,
  processWithdrawal,
  checkPaymentStatus,
} from "./services/unifiedPaymentService";
import { liveStripeRouter } from "./routers/liveStripe";
import { fidesmoNFCRouter } from "./routers/fidesmoNFC";
import { emvPaymentRouter } from "./routers/emvPayment";

// ============================================================================
// BANKING ROUTER — All wallet, deposit, withdraw, transaction operations
// ============================================================================
const bankRouter = router({
  /** Get user's wallet (auto-create if missing) */
  getWallet: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, ctx.user.id))
      .limit(1);

    if (wallet.length === 0) {
      await db.insert(wallets).values({
        userId: ctx.user.id,
        walletType: "prepaid",
        fundingSourceId: `wallet_${ctx.user.id}`,
        balance: "0.00",
        currency: "USD",
      });
      wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id))
        .limit(1);
    }

    return {
      id: wallet[0].id,
      balance: parseFloat(wallet[0].balance.toString()),
      currency: wallet[0].currency,
      status: wallet[0].status,
    };
  }),

  /** Get transaction history */
  getTransactions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const txns = await getTransactionsByUserId(ctx.user.id, input?.limit ?? 50);
      return txns.map((t) => ({
        id: t.id,
        type: t.transactionType,
        amount: parseFloat(t.amount as string),
        currency: t.currency,
        status: t.status,
        description: t.description,
        merchantName: t.merchantName,
        metadata: t.metadata ? JSON.parse(t.metadata) : null,
        createdAt: t.createdAt,
      }));
    }),

  /** Deposit funds via crypto, ACH, or wire */
  deposit: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        method: z.enum(["crypto", "ach", "wire"]),
        cryptoCurrency: z.enum(["BTC", "ETH", "SOL", "USDC", "USDT"]).optional(),
        bankAccount: z
          .object({
            accountNumber: z.string(),
            routingNumber: z.string(),
            bankName: z.string(),
            accountType: z.enum(["checking", "savings"]),
            accountHolder: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Ensure wallet exists
      let wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id))
        .limit(1);

      if (wallet.length === 0) {
        await db.insert(wallets).values({
          userId: ctx.user.id,
          walletType: "prepaid",
          fundingSourceId: `wallet_${ctx.user.id}`,
          balance: "0.00",
          currency: "USD",
        });
        wallet = await db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, ctx.user.id))
          .limit(1);
      }

      const result = await processDeposit({
        userId: ctx.user.id,
        amount: input.amount,
        method: input.method,
        cryptoCurrency: input.cryptoCurrency,
        bankAccount: input.bankAccount,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      // Log transaction
      const txStatus = result.status === "processing" ? "pending" : result.status;
      await db.insert(transactions).values({
        userId: ctx.user.id,
        walletId: wallet[0].id,
        transactionType: "topup",
        amount: input.amount.toString(),
        currency: "USD",
        status: txStatus as "pending" | "completed" | "failed",
        description: result.message,
        metadata: JSON.stringify({
          transactionId: result.transactionId,
          method: result.method,
          details: result.details,
        }),
      });

      return {
        transactionId: result.transactionId,
        method: result.method,
        status: result.status,
        amount: input.amount,
        message: result.message,
        estimatedCompletion: result.estimatedCompletion,
        details: result.details,
      };
    }),

  /** Withdraw funds via crypto, ACH, or wire */
  withdraw: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        method: z.enum(["crypto", "ach", "wire"]),
        destinationAddress: z.string().optional(),
        destinationBank: z
          .object({
            accountNumber: z.string(),
            routingNumber: z.string(),
            bankName: z.string(),
            accountType: z.enum(["checking", "savings"]),
            accountHolder: z.string(),
          })
          .optional(),
        beneficiaryBank: z
          .object({
            name: z.string(),
            swiftCode: z.string(),
            routingNumber: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, ctx.user.id))
        .limit(1);

      if (wallet.length === 0) {
        throw new Error("Wallet not found");
      }

      const currentBalance = parseFloat(wallet[0].balance.toString());
      if (currentBalance < input.amount) {
        throw new Error("Insufficient balance");
      }

      const result = await processWithdrawal({
        userId: ctx.user.id,
        amount: input.amount,
        method: input.method,
        destinationAddress: input.destinationAddress,
        destinationBank: input.destinationBank,
        beneficiaryBank: input.beneficiaryBank,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      // Log transaction
      const txStatus = result.status === "processing" ? "pending" : result.status;
      await db.insert(transactions).values({
        userId: ctx.user.id,
        walletId: wallet[0].id,
        transactionType: "transfer",
        amount: input.amount.toString(),
        currency: "USD",
        status: txStatus as "pending" | "completed" | "failed",
        description: result.message,
        metadata: JSON.stringify({
          transactionId: result.transactionId,
          method: result.method,
          details: result.details,
        }),
      });

      return {
        transactionId: result.transactionId,
        method: result.method,
        status: result.status,
        amount: input.amount,
        newBalance: currentBalance - input.amount,
        message: result.message,
        estimatedCompletion: result.estimatedCompletion,
        details: result.details,
      };
    }),

  /** Check payment status */
  checkStatus: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(async ({ input }) => {
      return checkPaymentStatus(input.transactionId);
    }),

  /** Get available payment methods */
  getPaymentMethods: publicProcedure.query(() => [
    {
      id: "crypto" as const,
      name: "Cryptocurrency",
      currencies: ["BTC", "ETH", "SOL", "USDC", "USDT"],
      estimatedTime: "10-30 minutes",
      description: "Deposit or withdraw via blockchain",
      icon: "bitcoin",
    },
    {
      id: "ach" as const,
      name: "ACH Transfer",
      estimatedTime: "2-3 business days",
      description: "Automated Clearing House transfer",
      icon: "building",
    },
    {
      id: "wire" as const,
      name: "Wire Transfer",
      estimatedTime: "Same day / next business day",
      description: "Domestic or international wire",
      icon: "globe",
    },
  ]),
});

// ============================================================================
// IMPLANT ROUTER — NFC implant management
// ============================================================================
const implantRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getImplantsByUserId(ctx.user.id);
  }),

  link: protectedProcedure
    .input(
      z.object({
        implantId: z.string().min(1),
        implantType: z.string().default("Apex Flex"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const implant = await createImplant({
        userId: ctx.user.id,
        implantId: input.implantId,
        implantType: input.implantType,
        status: "active",
      });
      return implant;
    }),
});

// ============================================================================
// CARD ROUTER — Virtual card management
// ============================================================================
const cardRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const allCards = await getCardsByUserId(ctx.user.id);
    return allCards.map((c) => ({
      id: c.id,
      last4: c.cardNumber.slice(-4),
      cardholderName: c.cardholderName,
      expiryMonth: c.expiryMonth,
      expiryYear: c.expiryYear,
      status: c.status,
      issuedAt: c.issuedAt,
    }));
  }),
});

// ============================================================================
// MAIN APP ROUTER
// ============================================================================


export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  bank: bankRouter,
  implant: implantRouter,
  card: cardRouter,
  payment: paymentRouter,
  paymentEmulator: paymentEmulatorRouter,
  microchip: microchipRouter,
  // Middleman bridge — the real Stripe-backed flow. Prefer these going forward.
  paymentMethods: paymentMethodsRouter,
  implantsBridge: implantsBridgeRouter,
  transactionsBridge: transactionsBridgeRouter,
  merchant: merchantRouter,
  fidesmo: fidesmoRouter,
  liveStripe: liveStripeRouter,
  fidesmoNFC: fidesmoNFCRouter,
  emvPayment: emvPaymentRouter,
});

export type AppRouter = typeof appRouter;
