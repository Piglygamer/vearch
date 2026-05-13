import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  processEMVTransaction,
  getImplantTransactionHistory,
  reverseEMVTransaction,
  validateEMVAuth,
  EMV_APPLET_CONFIG,
} from '../services/emvApplet';

export const emvPaymentRouter = router({
  /**
   * Process EMV transaction from merchant terminal
   * Called when implant is tapped at POS
   */
  processTransaction: protectedProcedure
    .input(
      z.object({
        implantId: z.string(),
        amount: z.number().positive(),
        currency: z.string().default('USD'),
        merchantId: z.string(),
        merchantName: z.string(),
        terminalId: z.string(),
        authData: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate EMV auth data if provided
      if (input.authData && !validateEMVAuth(input.authData)) {
        return {
          approved: false,
          transactionId: '',
          authorizationCode: '',
          responseCode: '05',
          message: 'Invalid authentication data',
        };
      }

      const result = await processEMVTransaction({
        userId: ctx.user.id,
        implantId: input.implantId,
        amount: input.amount,
        currency: input.currency,
        merchantId: input.merchantId,
        merchantName: input.merchantName,
        terminalId: input.terminalId,
        authData: input.authData,
      });

      return result;
    }),

  /**
   * Get transaction history for implant
   */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const history = await getImplantTransactionHistory(ctx.user.id, input.limit);
      return history;
    }),

  /**
   * Reverse/refund an EMV transaction
   */
  reverseTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await reverseEMVTransaction(input.transactionId, ctx.user.id);
      return result;
    }),

  /**
   * Get EMV applet configuration
   */
  getConfig: protectedProcedure.query(async () => {
    return EMV_APPLET_CONFIG;
  }),

  /**
   * Get transaction limits
   */
  getLimits: protectedProcedure.query(async () => {
    return {
      perTransaction: EMV_APPLET_CONFIG.limits.perTransaction,
      daily: EMV_APPLET_CONFIG.limits.daily,
      monthly: EMV_APPLET_CONFIG.limits.monthly,
    };
  }),
});
