import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  provisionImplantChip,
  getProvisioningStatus,
  updateApplet,
  getAvailableApplets,
} from '../services/fidesmoProvisioning';

export const fidesmoNFCRouter = router({
  /**
   * Provision a real NFC chip with payment applet
   */
  provisionChip: protectedProcedure
    .input(
      z.object({
        implantId: z.string(),
        nfcChipId: z.string(),
        appletId: z.string(),
        walletId: z.number(),
        cardToken: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await provisionImplantChip({
        userId: ctx.user.id,
        implantId: input.implantId,
        nfcChipId: input.nfcChipId,
        appletId: input.appletId,
        walletId: input.walletId,
        cardToken: input.cardToken,
      });

      return result;
    }),

  /**
   * Check provisioning status
   */
  checkStatus: protectedProcedure
    .input(z.object({ provisioningId: z.string() }))
    .query(async ({ input }) => {
      const status = await getProvisioningStatus(input.provisioningId);
      return status;
    }),

  /**
   * Update applet on provisioned chip
   */
  updateApplet: protectedProcedure
    .input(
      z.object({
        chipId: z.string(),
        newAppletId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await updateApplet(input.chipId, input.newAppletId);
      return result;
    }),

  /**
   * List available production applets
   */
  getApplets: protectedProcedure.query(async () => {
    const applets = getAvailableApplets();
    return applets;
  }),
});
