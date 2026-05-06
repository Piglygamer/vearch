/**
 * Tests for `server/services/merchantAuth.ts`.
 *
 * Verifies key generation, prefix lookup behavior, and constant-time hash
 * comparison. Uses an in-memory mock for the merchants DB.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => {
  const merchantsByPrefix = new Map<string, any>();
  return {
    createMerchant: vi.fn(async (m: any) => {
      const row = { id: 1, ...m, createdAt: new Date(), updatedAt: new Date() };
      merchantsByPrefix.set(m.apiKeyPrefix, row);
      return row;
    }),
    getMerchantByApiKeyPrefix: vi.fn(async (prefix: string) => {
      return merchantsByPrefix.get(prefix);
    }),
  };
});

import {
  generateMerchantApiKey,
  authenticateMerchantByKey,
  provisionMerchant,
  constantTimeEqual,
  sha256Hex,
} from "./services/merchantAuth";

describe("generateMerchantApiKey", () => {
  it("produces a vmk_<prefix>_<secret> key whose secret hashes to the stored hash", () => {
    const k = generateMerchantApiKey();
    expect(k.plaintext).toMatch(/^vmk_[0-9a-f]{12}_[0-9a-f]{48}$/);
    expect(k.prefix).toMatch(/^[0-9a-f]{12}$/);
    const secret = k.plaintext.slice(("vmk_" + k.prefix + "_").length);
    expect(sha256Hex(secret)).toBe(k.hash);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for equal strings of equal length", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });
  it("returns false for different strings of equal length", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });
  it("returns false for differing lengths without throwing", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});

describe("authenticateMerchantByKey", () => {
  it("returns null for missing or malformed keys", async () => {
    expect(await authenticateMerchantByKey(undefined)).toBeNull();
    expect(await authenticateMerchantByKey("")).toBeNull();
    expect(await authenticateMerchantByKey("not_a_vmk")).toBeNull();
    // "vmk_" prefix only, no payload at all.
    expect(await authenticateMerchantByKey("vmk_")).toBeNull();
    // Has a "_" but the prefix won't match any known merchant.
    expect(await authenticateMerchantByKey("vmk_unknown_secret")).toBeNull();
  });

  it("authenticates a freshly provisioned merchant and rejects a tampered secret", async () => {
    const { merchant, apiKey } = await provisionMerchant({
      name: "Test Coffee",
      stripeAccountId: "acct_test_1",
    });

    const ok = await authenticateMerchantByKey(apiKey);
    expect(ok?.id).toBe(merchant.id);
    expect(ok?.name).toBe("Test Coffee");

    // Tamper with the last char of the secret.
    const tampered = apiKey.slice(0, -1) + (apiKey.endsWith("0") ? "1" : "0");
    expect(await authenticateMerchantByKey(tampered)).toBeNull();
  });

  it("returns null when the prefix is unknown", async () => {
    const fake = "vmk_000000000000_" + "f".repeat(48);
    expect(await authenticateMerchantByKey(fake)).toBeNull();
  });
});
