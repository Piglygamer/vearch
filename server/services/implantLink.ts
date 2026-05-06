/**
 * Middleman bridge: implant <-> user UID linking.
 *
 * The implant carries a UID (the bytes the terminal reads). The UID is a
 * lookup key into our `implants` table. Resolving the UID gives us the
 * Vearch user, from which we derive the Stripe Customer and the default
 * saved PaymentMethod to charge.
 */

import { createImplant, getImplantByUid, setImplantUid, getDefaultPaymentMethodForUser, getUserById } from "../db";

/** Normalize a UID: trim, lowercase hex with no separators. */
export function normalizeUid(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
}

/**
 * Link a chip UID to a user. If the user has no implant row yet we create
 * one; otherwise we update the UID/label in place. UIDs are unique across
 * all users.
 */
export async function linkImplant(opts: {
  userId: number;
  uid: string;
  label?: string | null;
  implantType?: string;
}): Promise<{ id: number; uid: string }> {
  const uid = normalizeUid(opts.uid);
  if (uid.length < 8) throw new Error("UID is too short");

  const existing = await getImplantByUid(uid);
  if (existing) {
    if (existing.userId !== opts.userId) {
      throw new Error("This UID is already linked to another user");
    }
    return { id: existing.id, uid };
  }

  // New implant row. Use the UID as the legacy `implantId` to satisfy the
  // unique-not-null constraint left over from the simulator schema.
  const implant = await createImplant({
    userId: opts.userId,
    implantId: `uid_${uid}`,
    uid,
    label: opts.label ?? null,
    implantType: opts.implantType ?? "Apex Flex",
    status: "active",
  });
  return { id: implant.id, uid };
}

/**
 * Resolve a chip UID to (user, default payment method, implant id). Returns
 * null if the UID is unknown or no payment method is on file. Callers must
 * not leak which of the two failed.
 */
export async function resolveImplant(uid: string): Promise<{
  implantId: number;
  userId: number;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
} | null> {
  const normalized = normalizeUid(uid);
  if (!normalized) return null;

  const implant = await getImplantByUid(normalized);
  if (!implant || implant.status !== "active") return null;

  const user = await getUserById(implant.userId);
  if (!user || !user.stripeCustomerId) return null;

  const pm = await getDefaultPaymentMethodForUser(implant.userId);
  if (!pm) return null;

  return {
    implantId: implant.id,
    userId: user.id,
    stripeCustomerId: user.stripeCustomerId,
    stripePaymentMethodId: pm.stripePaymentMethodId,
  };
}

export { setImplantUid };
