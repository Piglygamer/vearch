/**
 * @deprecated Legacy simulator.
 *
 * Vearch does not issue cards. The user's saved card lives on their Stripe
 * Customer; charges are made off-session against that real card via
 * `merchant.charge` (server/routers/merchantRouter.ts). This router is kept
 * mounted to avoid breaking the legacy PaymentEmulator page and will be
 * removed in a follow-up PR.
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as stripeIssuing from "../services/stripeIssuingService";

export const paymentEmulatorRouter = router({
  // Create a real virtual card via Stripe Issuing
  createCard: protectedProcedure
    .input(z.object({ cardholderName: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const card = await stripeIssuing.createVirtualCard(
          input.cardholderName,
          ctx.user.id.toString()
        );
        return {
          success: true,
          card,
        };
      } catch (error) {
        console.error("Error creating card:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create virtual card",
        });
      }
    }),

  // Get card details from Stripe
  getCard: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ input }) => {
      try {
        const card = await stripeIssuing.getCard(input.cardId);
        if (!card) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found",
          });
        }
        return {
          success: true,
          card,
        };
      } catch (error) {
        console.error("Error retrieving card:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve card",
        });
      }
    }),

  // Fund a card via Stripe
  linkPaymentMethod: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        paymentMethodId: z.string(),
        amount: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const success = await stripeIssuing.fundCard(
          input.cardId,
          input.amount,
          input.paymentMethodId
        );

        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fund card",
          });
        }

        const card = await stripeIssuing.getCard(input.cardId);
        return {
          success: true,
          card: {
            ...card,
            balance: input.amount,
            linkedPaymentMethod: input.paymentMethodId,
          },
        };
      } catch (error) {
        console.error("Error linking payment method:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to link payment method",
        });
      }
    }),

  // Process a transaction via Stripe
  processTransaction: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        amount: z.number(),
        merchant: z.string(),
        description: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await stripeIssuing.processTransaction(
          input.cardId,
          input.amount,
          input.merchant,
          input.description
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Transaction failed",
          });
        }

        return {
          success: true,
          transaction: {
            id: result.transactionId,
            amount: input.amount,
            merchant: input.merchant,
            status: "completed",
            authCode: result.authCode,
            timestamp: new Date(),
            newBalance: 0, // Would need to fetch from Stripe
          },
        };
      } catch (error) {
        console.error("Error processing transaction:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process transaction",
        });
      }
    }),

  // Get transaction history from Stripe
  getTransactions: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ input }) => {
      try {
        const transactions = await stripeIssuing.getTransactionHistory(
          input.cardId
        );
        return {
          success: true,
          transactions,
        };
      } catch (error) {
        console.error("Error retrieving transactions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve transactions",
        });
      }
    }),

  // Emulate card scan
  emulateCardScan: protectedProcedure
    .input(z.object({ cardId: z.string(), pin: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const card = await stripeIssuing.getCard(input.cardId);
        if (!card) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Card not found",
          });
        }

        // Verify PIN (default: 1234)
        if (input.pin !== "1234") {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid PIN",
          });
        }

        const transactions = await stripeIssuing.getTransactionHistory(
          input.cardId
        );

        return {
          success: true,
          appletData: {
            aid: "A0000000045645415243 48",
            pan: card.pan,
            cvv: card.cvv,
            expiry: card.expiry,
            cardholderName: card.cardholderName,
            balance: card.balance,
            transactionCounter: transactions.length,
            status: card.status,
          },
        };
      } catch (error) {
        console.error("Error emulating card scan:", error);
        throw error;
      }
    }),

  // Get all user's cards
  getMyCards: protectedProcedure.query(async ({ ctx }) => {
    try {
      // In a real app, you'd query Stripe for all cards belonging to this user
      // For now, return empty array as Stripe doesn't provide a direct way to list all user cards
      return {
        success: true,
        cards: [],
      };
    } catch (error) {
      console.error("Error retrieving cards:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve cards",
      });
    }
  }),
});
