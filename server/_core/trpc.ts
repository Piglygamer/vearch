import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { Merchant } from "../../drizzle/schema";
import { authenticateMerchantByKey } from "../services/merchantAuth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * HTTP header used to authenticate merchant terminals against the
 * middleman bridge. The plaintext key is `vmk_<prefix>_<secret>`; see
 * `server/services/merchantAuth.ts`.
 */
export const MERCHANT_KEY_HEADER = "x-vearch-merchant-key";

/**
 * Procedure that requires a valid merchant API key in the
 * `x-vearch-merchant-key` request header. Attaches the resolved merchant
 * to `ctx.merchant` for downstream use.
 */
export const merchantProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const header = ctx.req.headers[MERCHANT_KEY_HEADER];
    const key = Array.isArray(header) ? header[0] : header;
    const merchant = await authenticateMerchantByKey(key);
    if (!merchant) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: `Missing or invalid ${MERCHANT_KEY_HEADER} header`,
      });
    }
    return next({ ctx: { ...ctx, merchant } });
  })
);

export type MerchantContext = TrpcContext & { merchant: Merchant };
