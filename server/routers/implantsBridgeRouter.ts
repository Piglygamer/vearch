/**
 * Middleman bridge: implant tRPC procedures (UID-only model).
 *
 * The chip carries a UID — no applet, no PAN, no balance. These procedures
 * let a signed-in user link a UID to themselves and list their implants.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { eq, and } from "drizzle-orm";
import { getDb, getImplantsByUserId, getImplantByUid } from "../db";
import { implants } from "../../drizzle/schema";
import { linkImplant, normalizeUid } from "../services/implantLink";
import { TRPCError } from "@trpc/server";

export const implantsBridgeRouter = router({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await getImplantsByUserId(ctx.user.id);
    return rows
      .filter((r) => r.uid) // only the new-style UID-linked implants
      .map((r) => ({
        id: r.id,
        uid: r.uid!,
        label: r.label,
        status: r.status,
        linkedAt: r.linkedAt,
      }));
  }),

  link: protectedProcedure
    .input(
      z.object({
        uid: z.string().min(8),
        label: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await linkImplant({
          userId: ctx.user.id,
          uid: input.uid,
          label: input.label ?? null,
        });
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Failed to link implant",
        });
      }
    }),

  unlink: protectedProcedure
    .input(z.object({ uid: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const normalized = normalizeUid(input.uid);
      const existing = await getImplantByUid(normalized);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Implant not found" });
      }
      await db
        .update(implants)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(and(eq(implants.id, existing.id), eq(implants.userId, ctx.user.id)));
      return { success: true } as const;
    }),
});
