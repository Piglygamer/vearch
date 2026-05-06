/**
 * Middleman bridge: merchant terminal endpoint.
 *
 * Authenticated by the `x-vearch-merchant-key` header (see
 * `server/_core/trpc.ts` for the middleware). The merchant POSTs a chip
 * UID + amount; we charge the cardholder's saved Stripe payment method
 * off-session and route funds to the merchant's connected account via
 * `transfer_data.destination`.
 */

import { z } from "zod";
import { router, merchantProcedure, MERCHANT_KEY_HEADER } from "../_core/trpc";
import { chargeByImplantUid } from "../services/charge";

export const merchantRouter = router({
  /**
   * Charge the implant owner's default Stripe PaymentMethod off-session.
   * Returns approve/decline plus a stable decline code the terminal can
   * surface to the merchant ("ask cardholder to confirm in app", etc.).
   */
  charge: merchantProcedure
    .input(
      z.object({
        uid: z.string().min(8),
        amountCents: z.number().int().positive(),
        currency: z.string().length(3).optional(),
        idempotencyKey: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return chargeByImplantUid({
        uid: input.uid,
        amountCents: input.amountCents,
        currency: input.currency,
        merchantId: ctx.merchant.id,
        merchantStripeAccountId: ctx.merchant.stripeAccountId,
        idempotencyKey: input.idempotencyKey,
      });
    }),

  /** No-op procedure useful for terminals to verify their key works. */
  whoami: merchantProcedure.query(({ ctx }) => {
    return {
      id: ctx.merchant.id,
      name: ctx.merchant.name,
      stripeAccountId: ctx.merchant.stripeAccountId,
    };
  }),
});

export const MERCHANT_KEY_HEADER_NAME = MERCHANT_KEY_HEADER;
