import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import * as fidesmoService from '../services/fidesmoService';

export const fidesmoRouter = router({
  /**
   * Start NFC ring detection and applet installation
   */
  startSession: protectedProcedure
    .input(z.object({
      cardId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await fidesmoService.startFidesmoSession(
        ctx.user.id.toString(),
        input.cardId
      );
      return session;
    }),

  /**
   * Get session status
   */
  getSessionStatus: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(({ input }) => {
      const session = fidesmoService.getSessionStatus(input.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      return session;
    }),

  /**
   * Personalize card with Stripe data
   */
  personalizeCard: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      cardNumber: z.string(),
      expMonth: z.number(),
      expYear: z.number(),
      cvv: z.string(),
      pin: z.string(),
    }))
    .mutation(async ({ input }) => {
      await fidesmoService.personalizeCard(
        input.sessionId,
        input.cardNumber,
        input.expMonth,
        input.expYear,
        input.cvv,
        input.pin
      );
      return { success: true };
    }),

  /**
   * Get applet AID
   */
  getAppletAID: protectedProcedure
    .query(() => {
      return { aid: fidesmoService.getAppletAID() };
    }),
});
