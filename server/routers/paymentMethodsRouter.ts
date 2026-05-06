/**
 * Middleman bridge: PaymentMethod tRPC procedures.
 *
 * Wraps Stripe Customer + SetupIntent + PaymentMethod operations. The PAN
 * never crosses this layer — the frontend confirms the SetupIntent client
 * secret with Stripe Elements directly.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createSetupIntent,
  detachPaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
} from "../services/stripeCustomer";
import { TRPCError } from "@trpc/server";

export const paymentMethodsRouter = router({
  /** List the saved cards on the user's Stripe Customer (mirror table). */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listPaymentMethods(ctx.user.id);
    return rows.map((r) => ({
      id: r.id,
      stripePaymentMethodId: r.stripePaymentMethodId,
      brand: r.brand,
      last4: r.last4,
      expMonth: r.expMonth,
      expYear: r.expYear,
      isDefault: r.isDefault,
    }));
  }),

  /** Create a SetupIntent for the frontend to confirm with Stripe Elements. */
  createSetupIntent: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await createSetupIntent(ctx.user.id);
    } catch (e) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: e instanceof Error ? e.message : "Failed to create SetupIntent",
      });
    }
  }),

  /** Mark one of the user's saved PaymentMethods as the default for charges. */
  setDefault: protectedProcedure
    .input(z.object({ paymentMethodDbId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await setDefaultPaymentMethod(ctx.user.id, input.paymentMethodDbId);
      return { success: true } as const;
    }),

  /** Detach a saved PaymentMethod from the user's Stripe Customer. */
  detach: protectedProcedure
    .input(z.object({ stripePaymentMethodId: z.string().startsWith("pm_") }))
    .mutation(async ({ ctx, input }) => {
      try {
        await detachPaymentMethod(ctx.user.id, input.stripePaymentMethodId);
        return { success: true } as const;
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Failed to detach payment method",
        });
      }
    }),
});
