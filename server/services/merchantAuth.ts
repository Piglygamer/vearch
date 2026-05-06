/**
 * Merchant API-key authentication.
 *
 * A merchant key is `vmk_<prefix>_<secret>`. The prefix is stored in plaintext
 * and used for the row lookup. The secret is hashed with scrypt (per-key salt)
 * so a database leak alone does not let an attacker recover or brute-force
 * keys — even though our generated secrets already carry 192 bits of entropy.
 * The plaintext key is shown to the merchant exactly once at creation.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createMerchant, getMerchantByApiKeyPrefix } from "../db";
import type { Merchant } from "../../drizzle/schema";

const KEY_PREFIX = "vmk_";

// scrypt parameters. N=16384 keeps an authentication call well under 100ms on
// modern hardware while still costing an attacker meaningfully if the hash
// table leaks. The serialized form is `scrypt$<salt-hex>$<hash-hex>`.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_BYTES = 16;

export function generateMerchantApiKey(): { plaintext: string; prefix: string; hash: string } {
  const prefix = randomBytes(6).toString("hex"); // 12 hex chars
  const secret = randomBytes(24).toString("hex"); // 48 hex chars (192 bits)
  const plaintext = `${KEY_PREFIX}${prefix}_${secret}`;
  const hash = scryptHash(secret);
  return { plaintext, prefix, hash };
}

/** Hash a secret with scrypt and a fresh random salt. */
export function scryptHash(secret: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(secret, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Constant-time compare of a candidate secret against a stored scrypt hash.
 * Returns false for any malformed stored hash.
 */
export function scryptVerify(secret: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "hex");
    expected = Buffer.from(parts[2], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;
  let derived: Buffer;
  try {
    derived = scryptSync(secret, salt, expected.length, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  } catch {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

/** Kept for convenience in tests and other callers; does not handle passwords. */
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

  if (!scryptVerify(secret, merchant.apiKeyHash)) return null;

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
