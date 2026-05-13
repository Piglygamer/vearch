import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { processLiveStripeCharge, getChargeStatus } from '../services/liveStripeProcessor';

export const liveStripeRouter = router({
  /**
   * Process a real Stripe charge for deposit
   */
  processCharge: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        paymentMethodId: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await processLiveStripeCharge({
        userId: ctx.user.id,
        amount: input.amount,
        description: input.description || `Deposit: $${input.amount}`,
        paymentMethodId: input.paymentMethodId,
      });

      return result;
    }),

  /**
   * Check charge status
   */
  checkStatus: protectedProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .query(async ({ input }) => {
      const status = await getChargeStatus(input.paymentIntentId);
      return status;
    }),

  /**
   * Get payment methods for user (requires Stripe customer ID)
   */
  getPaymentMethods: protectedProcedure.query(async ({ ctx }) => {
    // This would require integration with Stripe API
    // For now, return empty list
    return [];
  }),

  /**
   * Create setup intent for saving payment method
   */
  createSetupIntent: protectedProcedure.mutation(async ({ ctx }) => {
    // This would require integration with Stripe API
    return {
      setupIntentId: '',
      clientSecret: '',
    };
  }),
});
