export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Middleman bridge / Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  /** When true, the app is allowed to start with Stripe test keys and shows a TEST MODE banner. */
  demoMode: process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production",
};

/**
 * Validate that the environment is configured for the middleman bridge.
 * In production we require Stripe live keys + webhook secret; in demo mode
 * the app may start without them but the bridge endpoints will refuse to
 * process real charges.
 */
export function assertMiddlemanBridgeEnv(): void {
  if (!ENV.isProduction) return;
  const missing: string[] = [];
  if (!ENV.stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
  if (!ENV.stripeWebhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!ENV.stripePublishableKey) missing.push("VITE_STRIPE_PUBLISHABLE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `[Env] Middleman bridge requires the following env vars in production: ${missing.join(", ")}`
    );
  }
}
