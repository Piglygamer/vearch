# Legal posture

This document records the legal model Vearch operates under, so future
contributors don't accidentally break the assumptions.

## TL;DR

Vearch is a **payment-routing layer**, not a bank or wallet.

- Vearch **never holds customer funds**.
- Vearch **never sees the PAN** (full card number).
- **Stripe** is the processor of record. Cardholder funds flow:
  `cardholder card → Stripe → merchant's Stripe Connect account`.
- Merchants must complete **their own Stripe Connect onboarding**. Stripe
  performs KYB (Know-Your-Business) on each merchant; Vearch does not.
- Strong Customer Authentication (SCA / 3-D Secure) is performed by the
  cardholder's bank, mediated by Stripe; Vearch surfaces a stable
  `authentication_required` decline code so terminals can prompt the
  cardholder to confirm in the Vearch app.

This is the **payment facilitator / merchant-of-record-via-Stripe-Connect**
pattern. It is legal in most US states **without** a money transmitter license
(MTL), provided the no-funds-custody rule is preserved.

## What we do NOT do (and why it matters)

- **No "wallet balance".** We do not let users deposit money into a
  Vearch-controlled account. The moment we add a stored balance we become a
  money transmitter and the legal picture changes substantially.
- **No card issuance.** We do not issue virtual or physical cards. The chip
  carries only a UID. The card being charged is the user's own real card,
  saved on their Stripe Customer.
- **No EMV applet on the chip.** The chip is not running our code. It is a
  passive identifier.
- **No ACH, no wires, no crypto on/off-ramps.** All of those would be funds
  custody.
- **No KYC/AML on cardholders.** We rely on the issuing bank's KYC and on
  Stripe's fraud controls. We perform KYB on merchants only via Stripe
  Connect.

## What we DO

- Maintain a mapping `implantUID → userId → stripeCustomerId →
  default pm_… (PaymentMethod)`.
- On a merchant's authenticated request, create a Stripe `PaymentIntent`
  with `customer`, `payment_method`, `off_session: true`, `confirm: true`,
  and `transfer_data.destination` set to the merchant's connected account.
- Mirror Stripe events (`payment_intent.*`, `payment_method.*`,
  `charge.refunded`) into our database for the user's transaction history.

## Data we store

- The chip UID (a non-sensitive identifier, not a credential).
- The Stripe Customer id (`cus_…`) and PaymentMethod id (`pm_…`) for each
  saved card. **No PAN, no CVV, no expiry data beyond month/year for display.**
- The merchant's Stripe Connect account id and a SHA-256 hash of their
  API key. The plaintext key is shown to the merchant once and is not
  recoverable.
- Transaction records keyed by Stripe PaymentIntent id, used for the user's
  history view.

## Operational requirements

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
  `VITE_STRIPE_PUBLISHABLE_KEY` must all be set in production. The server
  fails fast on boot if any are missing.
- `DEMO_MODE=true` is allowed in non-production deployments and surfaces a
  TEST MODE banner in the UI; it does not change the code path, only the
  expected key types.
- Webhook signature verification is mandatory. Unsigned or improperly
  signed events are rejected with HTTP 400.

## If you are about to add a feature that holds funds

Stop. Open an issue. Adding a wallet balance, a stored value, an ACH
deposit, an account-to-account transfer, or any other feature where Vearch
holds money even momentarily very likely converts Vearch into a money
transmitter and triggers state-by-state MTL requirements (and at federal
level, FinCEN MSB registration). The architecture above is designed to
avoid that. Don't break it without an explicit legal sign-off.
