/**
 * Middleman bridge: read-only transactions feed for the signed-in user.
 *
 * Source of truth is populated by `chargeByImplantUid` and the Stripe
 * webhook. This procedure returns the user's recent charge history.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getTransactionsByUserId } from "../db";

export const transactionsBridgeRouter = router({
  listMine: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await getTransactionsByUserId(ctx.user.id, input?.limit ?? 50);
      return rows.map((t) => ({
        id: t.id,
        type: t.transactionType,
        amount: parseFloat(t.amount as unknown as string),
        currency: t.currency,
        status: t.status,
        description: t.description,
        merchantName: t.merchantName,
        stripePaymentIntentId: t.stripePaymentIntentId,
        createdAt: t.createdAt,
      }));
    }),
});
