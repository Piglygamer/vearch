/**
 * Tests for the merchant tRPC router.
 *
 * Verifies that:
 *  1. `merchant.charge` and `merchant.whoami` reject calls with no API key.
 *  2. They reject calls with an invalid key.
 *  3. They accept calls with a valid key and forward the merchant context.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

process.env.DATABASE_URL = "";
// The legacy `paymentEmulator` router (mounted in appRouter) imports a module
// that instantiates Stripe at load time. Stub the offending module so the
// import graph doesn't crash; the actual Stripe client is never invoked here
// because we mock `chargeByImplantUid` below.
vi.mock("./services/stripeIssuingService", () => ({
  createVirtualCard: vi.fn(),
  getCard: vi.fn(),
  fundCard: vi.fn(),
  processTransaction: vi.fn(),
  getTransactionHistory: vi.fn(),
}));

// Mock charge so we don't actually contact Stripe.
vi.mock("./services/charge", () => ({
  chargeByImplantUid: vi
    .fn()
    .mockResolvedValue({ approved: true, paymentIntentId: "pi_mock", amountCents: 100, currency: "usd" }),
}));

// In-memory merchant registry consumed by merchantAuth via the db mock.
const merchantsByPrefix = new Map<string, any>();
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getMerchantByApiKeyPrefix: vi.fn(async (prefix: string) => merchantsByPrefix.get(prefix)),
    createMerchant: vi.fn(async (m: any) => {
      const row = { id: 7, ...m, createdAt: new Date(), updatedAt: new Date() };
      merchantsByPrefix.set(m.apiKeyPrefix, row);
      return row;
    }),
  };
});

import { appRouter } from "./routers";
import { provisionMerchant } from "./services/merchantAuth";
import { chargeByImplantUid } from "./services/charge";
import type { TrpcContext } from "./_core/context";

function makeCtx(headers: Record<string, string> = {}): TrpcContext {
  return {
    user: null,
    req: { headers, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("merchant router auth", () => {
  beforeEach(() => {
    vi.mocked(chargeByImplantUid).mockClear();
  });

  it("merchant.whoami rejects when no key header is present", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(caller.merchant.whoami()).rejects.toBeInstanceOf(TRPCError);
  });

  it("merchant.whoami rejects an invalid key", async () => {
    const caller = appRouter.createCaller(
      makeCtx({ "x-vearch-merchant-key": "vmk_aaaaaaaaaaaa_" + "f".repeat(48) })
    );
    await expect(caller.merchant.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("merchant.whoami returns merchant info for a valid key", async () => {
    const { apiKey, merchant } = await provisionMerchant({
      name: "Bridge Coffee",
      stripeAccountId: "acct_bridge",
    });
    const caller = appRouter.createCaller(makeCtx({ "x-vearch-merchant-key": apiKey }));
    const r = await caller.merchant.whoami();
    expect(r).toEqual({
      id: merchant.id,
      name: "Bridge Coffee",
      stripeAccountId: "acct_bridge",
    });
  });

  it("merchant.charge requires a valid key and forwards merchant context to the service", async () => {
    const { apiKey } = await provisionMerchant({
      name: "Bridge Coffee 2",
      stripeAccountId: "acct_bridge_2",
    });

    // No key — denied.
    const anon = appRouter.createCaller(makeCtx({}));
    await expect(
      anon.merchant.charge({ uid: "deadbeefcafe", amountCents: 250 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Valid key — forwarded.
    const caller = appRouter.createCaller(makeCtx({ "x-vearch-merchant-key": apiKey }));
    const r = await caller.merchant.charge({
      uid: "deadbeefcafe",
      amountCents: 250,
      idempotencyKey: "tap-001",
    });
    expect(r).toEqual({ approved: true, paymentIntentId: "pi_mock", amountCents: 100, currency: "usd" });
    expect(chargeByImplantUid).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "deadbeefcafe",
        amountCents: 250,
        merchantStripeAccountId: "acct_bridge_2",
        idempotencyKey: "tap-001",
      })
    );
  });
});
