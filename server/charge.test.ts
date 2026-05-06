/**
 * Tests for the middleman-bridge charge service. Stripe is mocked — the
 * goal is to verify that we call Stripe with off_session+confirm, surface
 * the correct decline codes, and forward the idempotency key.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Make the service modules treat the absence of a DB as a no-op so we can
// run without a real MySQL.
process.env.DATABASE_URL = "";

import { chargeByImplantUid, mapStripeError } from "./services/charge";

// Mock the implantLink module so we don't need a real DB lookup.
vi.mock("./services/implantLink", () => ({
  resolveImplant: vi.fn(),
  normalizeUid: (s: string) => s.toLowerCase().replace(/[^0-9a-f]/g, ""),
}));
import { resolveImplant } from "./services/implantLink";

// Provide a no-op DB so the rate limiter and createTransaction are skipped.
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    createTransaction: vi.fn().mockResolvedValue(undefined),
  };
});

function fakeStripe(piResponse: unknown) {
  return {
    paymentIntents: {
      create: vi.fn().mockImplementation(async () => piResponse),
    },
  } as any;
}

function fakeStripeThrowing(err: unknown) {
  return {
    paymentIntents: {
      create: vi.fn().mockImplementation(async () => {
        throw err;
      }),
    },
  } as any;
}

const RESOLVED = {
  implantId: 99,
  userId: 42,
  stripeCustomerId: "cus_test123",
  stripePaymentMethodId: "pm_test456",
};

describe("chargeByImplantUid", () => {
  beforeEach(() => {
    vi.mocked(resolveImplant).mockReset();
  });

  it("returns unknown_implant when the UID does not resolve", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(null);
    const stripe = fakeStripe({ status: "succeeded", id: "pi_x" });
    const r = await chargeByImplantUid(
      { uid: "deadbeefcafe", amountCents: 500, merchantId: 1, merchantStripeAccountId: "acct_x" },
      stripe
    );
    expect(r).toEqual({
      approved: false,
      declineCode: "unknown_implant",
      message: expect.any(String),
    });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("rejects non-positive amounts", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(RESOLVED);
    const stripe = fakeStripe({});
    const r = await chargeByImplantUid(
      { uid: "deadbeefcafe", amountCents: 0, merchantId: 1, merchantStripeAccountId: "acct_x" },
      stripe
    );
    expect(r.approved).toBe(false);
    if (!r.approved) expect(r.declineCode).toBe("processing_error");
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("creates an off-session, auto-confirmed PaymentIntent and returns approved", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(RESOLVED);
    const stripe = fakeStripe({ id: "pi_ok", status: "succeeded" });

    const r = await chargeByImplantUid(
      {
        uid: "DE:AD:BE:EF:CA:FE:01:02",
        amountCents: 1234,
        currency: "USD",
        merchantId: 7,
        merchantStripeAccountId: "acct_merchant",
        idempotencyKey: "tx-123",
      },
      stripe
    );

    expect(r).toEqual({ approved: true, paymentIntentId: "pi_ok", amountCents: 1234, currency: "usd" });
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    const [body, options] = stripe.paymentIntents.create.mock.calls[0];
    expect(body).toMatchObject({
      amount: 1234,
      currency: "usd",
      customer: "cus_test123",
      payment_method: "pm_test456",
      off_session: true,
      confirm: true,
      transfer_data: { destination: "acct_merchant" },
    });
    expect(body.metadata).toMatchObject({
      vearchUserId: "42",
      vearchMerchantId: "7",
    });
    expect(options).toEqual({ idempotencyKey: "tx-123" });
  });

  it("maps requires_action to authentication_required", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(RESOLVED);
    const stripe = fakeStripe({ id: "pi_3ds", status: "requires_action" });
    const r = await chargeByImplantUid(
      { uid: "deadbeefcafe", amountCents: 500, merchantId: 1, merchantStripeAccountId: "acct_x" },
      stripe
    );
    expect(r).toMatchObject({
      approved: false,
      declineCode: "authentication_required",
      paymentIntentId: "pi_3ds",
    });
  });

  it("maps a thrown StripeCardError to card_declined", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(RESOLVED);
    const stripe = fakeStripeThrowing({
      type: "StripeCardError",
      code: "card_declined",
      message: "Your card was declined.",
      raw: { payment_intent: { id: "pi_decl" } },
    });
    const r = await chargeByImplantUid(
      { uid: "deadbeefcafe", amountCents: 500, merchantId: 1, merchantStripeAccountId: "acct_x" },
      stripe
    );
    expect(r).toMatchObject({
      approved: false,
      declineCode: "card_declined",
      paymentIntentId: "pi_decl",
    });
  });

  it("maps a thrown authentication_required error correctly", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(RESOLVED);
    const stripe = fakeStripeThrowing({
      type: "StripeCardError",
      code: "authentication_required",
      message: "Authentication required",
      raw: { payment_intent: { id: "pi_3ds_e" } },
    });
    const r = await chargeByImplantUid(
      { uid: "deadbeefcafe", amountCents: 500, merchantId: 1, merchantStripeAccountId: "acct_x" },
      stripe
    );
    expect(r).toMatchObject({
      approved: false,
      declineCode: "authentication_required",
      paymentIntentId: "pi_3ds_e",
    });
  });

  it("does not pass an idempotencyKey option when none is provided", async () => {
    vi.mocked(resolveImplant).mockResolvedValue(RESOLVED);
    const stripe = fakeStripe({ id: "pi", status: "succeeded" });
    await chargeByImplantUid(
      { uid: "deadbeefcafe", amountCents: 100, merchantId: 1, merchantStripeAccountId: "acct_x" },
      stripe
    );
    const [, options] = stripe.paymentIntents.create.mock.calls[0];
    expect(options).toBeUndefined();
  });
});

describe("mapStripeError", () => {
  it("falls back to processing_error for unrecognized errors", () => {
    expect(mapStripeError(new Error("boom"))).toMatchObject({
      approved: false,
      declineCode: "processing_error",
    });
  });

  it("flags StripeInvalidRequestError as configuration_error", () => {
    expect(mapStripeError({ type: "StripeInvalidRequestError", message: "bad" })).toMatchObject({
      approved: false,
      declineCode: "configuration_error",
      message: "bad",
    });
  });
});
