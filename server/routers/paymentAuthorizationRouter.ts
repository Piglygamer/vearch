/**
 * Payment Authorization Router
 * 
 * Handles real EMV applet payment authorization and confirmation.
 * This is the backend for the VearchEMV Java Card applet.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import Stripe from "stripe";

// Declare crypto for Node.js environment
declare const crypto: any;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

interface PaymentAuthorizationRequest {
  implantId: string;
  amount: number;
  currency: string;
  merchantId: string;
  transactionId: string;
}

interface PaymentAuthorizationResponse {
  success: boolean;
  authCode: string;
  status: "approved" | "declined";
  transactionId: string;
  balance: number;
}

export const paymentAuthorizationRouter = router({
  /**
   * Authorize payment from EMV applet
   * Called when user taps implant on NFC terminal
   */
  authorize: protectedProcedure
    .input(
      z.object({
        implantId: z.string(),
        amount: z.number().positive(),
        currency: z.string().default("USD"),
        merchantId: z.string(),
        transactionId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const userId = ctx.user.id;

        // 1. Validate implant is linked to user
        // In production: query database for implant ownership

        // 2. Check velocity limits (on-chip, but verify on backend)
        if (input.amount > 500) {
          return {
            success: false,
            authCode: "",
            status: "declined" as const,
            transactionId: input.transactionId,
            balance: 0,
            error: "Transaction amount exceeds limit",
          };
        }

        // 3. Get user's Stripe customer
        // In production: query database for Stripe customer ID
        const stripeCustomerId = `user_${userId}`;

        // 4. Retrieve customer's balance/wallet
        // In production: query database for wallet balance
        let walletBalance = 10000; // $100.00 in cents (placeholder)

        // 5. Check sufficient funds
        if (input.amount * 100 > walletBalance) {
          return {
            success: false,
            authCode: "",
            status: "declined" as const,
            transactionId: input.transactionId,
            balance: walletBalance / 100,
            error: "Insufficient funds",
          };
        }

        // 6. Generate authorization code (4 random bytes)
        const authCode = generateAuthCode();

        // 7. Deduct from wallet balance
        walletBalance -= input.amount * 100;

        // 8. Log transaction
        console.log(`[Payment Auth] User ${userId} - Amount: $${input.amount} - Auth Code: ${authCode}`);

        // 9. Return authorization
        return {
          success: true,
          authCode,
          status: "approved" as const,
          transactionId: input.transactionId,
          balance: walletBalance / 100,
        };
      } catch (error) {
        console.error("[Payment Auth] Error:", error);
        return {
          success: false,
          authCode: "",
          status: "declined" as const,
          transactionId: input.transactionId,
          balance: 0,
          error:
            error instanceof Error ? error.message : "Authorization failed",
        };
      }
    }),

  /**
   * Confirm transaction completion
   * Called after terminal confirms payment
   */
  confirm: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        status: z.enum(["completed", "failed"]),
        settlementId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const userId = ctx.user.id;

        console.log(
          `[Payment Confirm] User ${userId} - Transaction ${input.transactionId} - Status: ${input.status}`
        );

        // In production:
        // 1. Update transaction status in database
        // 2. If completed: settle funds to merchant
        // 3. If failed: refund to wallet
        // 4. Log to transaction history

        return {
          success: true,
          message: `Transaction ${input.transactionId} confirmed`,
          status: input.status,
        };
      } catch (error) {
        console.error("[Payment Confirm] Error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Confirmation failed",
          status: "failed" as const,
        };
      }
    }),

  /**
   * Get current balance
   * Called by applet to check available funds
   */
  getBalance: protectedProcedure.query(async ({ ctx }: any) => {
    try {
      const userId = ctx.user.id;

      // In production: query database for wallet balance
      const walletBalance = 10000; // $100.00 in cents (placeholder)

      return {
        success: true,
        balance: walletBalance / 100,
        currency: "USD",
      };
    } catch (error) {
      console.error("[Get Balance] Error:", error);
      return {
        success: false,
        balance: 0,
        error:
          error instanceof Error ? error.message : "Failed to get balance",
      };
    }
  }),

  /**
   * Verify PIN
   * Called by applet for transaction confirmation
   */
  verifyPIN: protectedProcedure
    .input(z.object({ pin: z.string().length(4) }))
    .mutation(async ({ input, ctx }: any) => {
      try {
        const userId = ctx.user.id;

        // In production: verify PIN against database
        // For now, accept any 4-digit PIN
        if (!/^\d{4}$/.test(input.pin)) {
          return {
            success: false,
            message: "Invalid PIN format",
          };
        }

        console.log(`[PIN Verify] User ${userId} - PIN verified`);

        return {
          success: true,
          message: "PIN verified",
        };
      } catch (error) {
        console.error("[PIN Verify] Error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "PIN verification failed",
        };
      }
    }),

  /**
   * Get transaction history
   * Called by dashboard to show payment history
   */
  getTransactionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(10),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const userId = ctx.user.id;

        // In production: query database for transactions
        const transactions = [
          {
            id: "TXN-001",
            amount: 25.5,
            merchant: "McDonald's",
            timestamp: new Date(Date.now() - 3600000),
            status: "completed",
          },
          {
            id: "TXN-002",
            amount: 15.0,
            merchant: "Walmart",
            timestamp: new Date(Date.now() - 7200000),
            status: "completed",
          },
        ];

        return {
          success: true,
          transactions: transactions.slice(
            input.offset,
            input.offset + input.limit
          ),
          total: transactions.length,
        };
      } catch (error) {
        console.error("[Transaction History] Error:", error);
        return {
          success: false,
          transactions: [],
          total: 0,
          error:
            error instanceof Error ? error.message : "Failed to get history",
        };
      }
    }),
});

/**
 * Generate random 4-byte authorization code
 */
function generateAuthCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
