/**
 * Merchant API-key authentication.
 *
 * A merchant key is `vmk_<prefix>_<secret>`. The prefix is stored in plaintext
 * (used for the row lookup) and the secret is compared against a SHA-256 hash
 * with constant-time equality. The plaintext key is shown to the merchant
 * exactly once at creation.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createMerchant, getMerchantByApiKeyPrefix } from "../db";
import type { Merchant } from "../../drizzle/schema";

const KEY_PREFIX = "vmk_";

export function generateMerchantApiKey(): { plaintext: string; prefix: string; hash: string } {
  const prefix = randomBytes(6).toString("hex"); // 12 hex chars
  const secret = randomBytes(24).toString("hex"); // 48 hex chars
  const plaintext = `${KEY_PREFIX}${prefix}_${secret}`;
  const hash = sha256Hex(secret);
  return { plaintext, prefix, hash };
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Constant-time string comparison.
 * Returns false if lengths differ to avoid timing leaks via length.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Look up a merchant by an API key string. Returns the merchant on success
 * or null if the key is malformed, unknown, or the secret doesn't match.
 */
export async function authenticateMerchantByKey(rawKey: string | undefined | null): Promise<Merchant | null> {
  if (!rawKey || typeof rawKey !== "string") return null;
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const rest = rawKey.slice(KEY_PREFIX.length);
  const sep = rest.indexOf("_");
  if (sep <= 0) return null;
  const prefix = rest.slice(0, sep);
  const secret = rest.slice(sep + 1);
  if (!prefix || !secret) return null;

  const merchant = await getMerchantByApiKeyPrefix(prefix);
  if (!merchant) return null;
  if (merchant.status !== "active") return null;

  const computed = sha256Hex(secret);
  if (!constantTimeEqual(computed, merchant.apiKeyHash)) return null;

  return merchant;
}

/** Provision a new merchant. The plaintext key in the response must be
 * stored by the merchant immediately — it is not recoverable. */
export async function provisionMerchant(opts: {
  name: string;
  stripeAccountId: string;
}): Promise<{ merchant: Merchant; apiKey: string }> {
  const { plaintext, prefix, hash } = generateMerchantApiKey();
  const merchant = await createMerchant({
    name: opts.name,
    stripeAccountId: opts.stripeAccountId,
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    status: "active",
  });
  return { merchant, apiKey: plaintext };
}
