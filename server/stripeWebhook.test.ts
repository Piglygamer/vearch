/**
 * Tests for the Stripe webhook handler.
 *
 * Verifies that:
 *  1. Signature verification rejects tampered bodies.
 *  2. The dispatch table updates the right db helpers for each event.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

process.env.DATABASE_URL = "";

vi.mock("./db", () => ({
  detachPaymentMethodByStripeId: vi.fn().mockResolvedValue(undefined),
  upsertPaymentMethod: vi.fn().mockResolvedValue(undefined),
  getTransactionByStripePaymentIntentId: vi.fn().mockResolvedValue(undefined),
  updateTransactionByStripePaymentIntentId: vi.fn().mockResolvedValue(undefined),
  createTransaction: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

import {
  detachPaymentMethodByStripeId,
  updateTransactionByStripePaymentIntentId,
  upsertPaymentMethod,
  getTransactionByStripePaymentIntentId,
  createTransaction,
} from "./db";
import { processStripeEvent, verifyStripeSignature } from "./_core/stripeWebhook";

const SECRET = "whsec_test_secret_long_enough_for_hmac";

function signed(payload: object): { rawBody: string; signature: string } {
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret: SECRET,
    timestamp,
  });
  return { rawBody, signature };
}

describe("verifyStripeSignature", () => {
  it("returns the parsed event when the signature matches", () => {
    const payload = { id: "evt_1", type: "ping", data: { object: {} } };
    const { rawBody, signature } = signed(payload);
    const ev = verifyStripeSignature(rawBody, signature, SECRET);
    expect(ev?.id).toBe("evt_1");
    expect(ev?.type).toBe("ping");
  });

  it("returns null when the body is tampered", () => {
    const payload = { id: "evt_2", type: "ping", data: { object: {} } };
    const { signature } = signed(payload);
    const tampered = JSON.stringify({ ...payload, type: "evil" });
    expect(verifyStripeSignature(tampered, signature, SECRET)).toBeNull();
  });

  it("returns null when the secret is wrong", () => {
    const payload = { id: "evt_3", type: "ping", data: { object: {} } };
    const { rawBody, signature } = signed(payload);
    expect(verifyStripeSignature(rawBody, signature, "whsec_wrong_one")).toBeNull();
  });
});

describe("processStripeEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("payment_intent.succeeded with an existing local row updates the row to completed", async () => {
    vi.mocked(getTransactionByStripePaymentIntentId).mockResolvedValueOnce({ id: 1 } as any);
    await processStripeEvent({
      id: "evt_succ",
      type: "payment_intent.succeeded",
      data: {
        object: { id: "pi_a", amount: 500, currency: "usd", metadata: { vearchUserId: "1" } },
      },
    } as unknown as Stripe.Event);

    expect(updateTransactionByStripePaymentIntentId).toHaveBeenCalledWith("pi_a", { status: "completed" });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("payment_intent.succeeded without a local row inserts a transaction from metadata", async () => {
    vi.mocked(getTransactionByStripePaymentIntentId).mockResolvedValueOnce(undefined);
    await processStripeEvent({
      id: "evt_succ2",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_b",
          amount: 999,
          currency: "usd",
          metadata: { vearchUserId: "42", vearchImplantUid: "deadbeefcafe" },
        },
      },
    } as unknown as Stripe.Event);

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        stripePaymentIntentId: "pi_b",
        status: "completed",
        currency: "USD",
      })
    );
  });

  it("payment_intent.payment_failed marks the local transaction as failed", async () => {
    await processStripeEvent({
      id: "evt_fail",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_f",
          last_payment_error: { decline_code: "insufficient_funds", message: "no money" },
        },
      },
    } as unknown as Stripe.Event);

    expect(updateTransactionByStripePaymentIntentId).toHaveBeenCalledWith(
      "pi_f",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("charge.refunded marks the linked transaction as reversed", async () => {
    await processStripeEvent({
      id: "evt_ref",
      type: "charge.refunded",
      data: { object: { id: "ch_x", payment_intent: "pi_ref" } },
    } as unknown as Stripe.Event);

    expect(updateTransactionByStripePaymentIntentId).toHaveBeenCalledWith("pi_ref", { status: "reversed" });
  });

  it("payment_method.detached removes the local row", async () => {
    await processStripeEvent({
      id: "evt_det",
      type: "payment_method.detached",
      data: { object: { id: "pm_to_delete" } },
    } as unknown as Stripe.Event);

    expect(detachPaymentMethodByStripeId).toHaveBeenCalledWith("pm_to_delete");
  });

  it("payment_method.attached without a known customer skips the upsert", async () => {
    // No DB → lookupUserIdByStripeCustomer returns null, so no upsert happens.
    await processStripeEvent({
      id: "evt_att",
      type: "payment_method.attached",
      data: {
        object: {
          id: "pm_new",
          customer: "cus_unknown",
          card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
        },
      },
    } as unknown as Stripe.Event);

    expect(upsertPaymentMethod).not.toHaveBeenCalled();
  });
});
