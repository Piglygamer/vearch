import Stripe from "stripe";
import { ENV } from "../_core/env";

/**
 * Lazy Stripe client. Created on first use so importing this module never
 * throws when STRIPE_SECRET_KEY is unset (tests, local dev, demo mode).
 *
 * Tests should NOT call this directly — they should pass a mock Stripe client
 * to the functions that accept one (e.g. `chargeByImplantUid`).
 */
let _client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_client) {
    if (!ENV.stripeSecretKey) {
      throw new Error("[Stripe] STRIPE_SECRET_KEY is not configured");
    }
    _client = new Stripe(ENV.stripeSecretKey);
  }
  return _client;
}

/** Test-only: replace the cached singleton. */
export function __setStripeForTests(client: unknown): void {
  _client = client as Stripe;
}
