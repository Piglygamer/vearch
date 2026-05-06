import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Implants table: Tracks NFC/payment implants linked to users.
 *
 * In the middleman-bridge model, the implant is just a unique identifier (UID)
 * that the terminal reads. It carries no PAN, no balance, and no EMV applet.
 * The `uid` column stores those bytes (lowercase hex). Lookups during a charge
 * resolve `uid -> userId -> default Stripe payment method`.
 *
 * Other columns are retained for backward compatibility with the legacy
 * applet/NxtPay simulator code paths, which are deprecated.
 */
export const implants = mysqlTable("implants", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  implantId: varchar("implantId", { length: 128 }).notNull().unique(), // Legacy: app-level identifier
  /** Bytes read off the chip (lowercase hex). Required for the middleman bridge. */
  uid: varchar("uid", { length: 128 }).unique(),
  /** Optional human label, e.g. "left hand". */
  label: varchar("label", { length: 128 }),
  implantType: varchar("implantType", { length: 64 }).notNull(), // e.g., "NxtPay", "Apex Flex"
  nxtpayTokenId: varchar("nxtpayTokenId", { length: 256 }), // Legacy: NxtPay backend token
  status: mysqlEnum("status", ["active", "expiring", "expired", "revoked"]).default("active").notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Legacy: year 30000 = never
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Implant = typeof implants.$inferSelect;
export type InsertImplant = typeof implants.$inferInsert;

/**
 * Tokens table: Tracks payment tokens (both NxtPay and Vearch-issued).
 * Handles token lifecycle, expiration, and re-provisioning.
 */
export const tokens = mysqlTable("tokens", {
  id: int("id").autoincrement().primaryKey(),
  implantId: int("implantId").notNull(), // Foreign key to implants
  tokenType: mysqlEnum("tokenType", ["nxtpay", "vearch"]).notNull(),
  tokenValue: varchar("tokenValue", { length: 512 }).notNull(), // Encrypted token data
  expiresAt: timestamp("expiresAt").notNull(), // Token expiration date
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["active", "expiring", "expired", "revoked"]).default("active").notNull(),
  reprovisioningScheduledAt: timestamp("reprovisioningScheduledAt"), // When re-provisioning is scheduled
  reprovisionedAt: timestamp("reprovisionedAt"), // When token was re-provisioned
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Token = typeof tokens.$inferSelect;
export type InsertToken = typeof tokens.$inferInsert;

/**
 * Cards table: Virtual EMV cards issued by Vearch Vault.
 * Cards have extended expiration dates (e.g., 7/5/30979) and are renewable.
 */
export const cards = mysqlTable("cards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  implantId: int("implantId"), // Optional: linked to specific implant
  cardNumber: varchar("cardNumber", { length: 256 }).notNull(), // Encrypted PAN
  cardToken: varchar("cardToken", { length: 512 }).notNull(), // Tokenized representation
  expiryMonth: int("expiryMonth").notNull(), // 1-12 (always 12 for immortal cards)
  expiryYear: int("expiryYear").notNull(), // Always 30000 for immortal cards
  cvv: varchar("cvv", { length: 256 }), // Encrypted CVV
  cardholderName: varchar("cardholderName", { length: 256 }),
  status: mysqlEnum("status", ["active", "suspended", "expired", "revoked"]).default("active").notNull(),
  fundingSourceId: int("fundingSourceId"), // Foreign key to wallets/funding sources
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

/**
 * Wallets table: User funding sources (bank accounts, prepaid balances, etc.).
 * Tracks balance, funding method, and connection status.
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletType: mysqlEnum("walletType", ["bank_account", "prepaid", "crypto", "other"]).notNull(),
  fundingSourceId: varchar("fundingSourceId", { length: 256 }).notNull(), // Reference to external funding source
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0.00").notNull(), // Current balance
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["active", "pending", "suspended", "disconnected"]).default("active").notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

/**
 * Transactions table: Audit trail for all payment transactions.
 * Tracks card usage, funding source, amounts, and status.
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: int("cardId"),
  implantId: int("implantId"),
  walletId: int("walletId"),
  transactionType: mysqlEnum("transactionType", ["payment", "refund", "topup", "transfer"]).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "reversed"]).default("pending").notNull(),
  merchantName: varchar("merchantName", { length: 256 }),
  description: text("description"),
  metadata: text("metadata"), // JSON: additional transaction details
  /** Stripe PaymentIntent id when this transaction was created via the middleman bridge. */
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * TokenReprovisioningLog table: Audit trail for token re-provisioning events.
 * Tracks when tokens are renewed, why, and the outcome.
 */
export const tokenReprovisioningLog = mysqlTable("tokenReprovisioningLog", {
  id: int("id").autoincrement().primaryKey(),
  implantId: int("implantId").notNull(),
  oldTokenId: int("oldTokenId"),
  newTokenId: int("newTokenId"),
  reason: mysqlEnum("reason", ["expiration_approaching", "scheduled_renewal", "manual_request", "security_patch"]).notNull(),
  status: mysqlEnum("status", ["initiated", "in_progress", "completed", "failed"]).default("initiated").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type TokenReprovisioningLog = typeof tokenReprovisioningLog.$inferSelect;
export type InsertTokenReprovisioningLog = typeof tokenReprovisioningLog.$inferInsert;

/**
 * SystemHealth table: Self-monitoring and self-healing metrics.
 * Tracks system vulnerabilities, patches applied, and auto-recovery events.
 */
export const systemHealth = mysqlTable("systemHealth", {
  id: int("id").autoincrement().primaryKey(),
  checkType: mysqlEnum("checkType", ["vulnerability_scan", "code_integrity", "database_health", "api_health"]).notNull(),
  status: mysqlEnum("status", ["healthy", "warning", "critical"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  description: text("description"),
  autoRepaired: boolean("autoRepaired").default(false),
  repairDetails: text("repairDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type SystemHealth = typeof systemHealth.$inferSelect;
export type InsertSystemHealth = typeof systemHealth.$inferInsert;

/**
 * StripeAccounts table: Tracks Stripe Connected Accounts for each user.
 * Enables multi-user fund isolation and independent payment processing.
 */
export const stripeAccounts = mysqlTable("stripeAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stripeAccountId: varchar("stripeAccountId", { length: 256 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "active", "restricted", "suspended"]).default("pending").notNull(),
  chargesEnabled: boolean("chargesEnabled").default(false),
  payoutsEnabled: boolean("payoutsEnabled").default(false),
  onboardingUrl: text("onboardingUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StripeAccount = typeof stripeAccounts.$inferSelect;
export type InsertStripeAccount = typeof stripeAccounts.$inferInsert;

/**
 * Subscriptions table: Tracks user subscription tiers via Stripe.
 * Stores subscription status, tier, and period information.
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // One active subscription per user
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 256 }).notNull().unique(),
  tier: mysqlEnum("tier", ["BASIC", "PRO", "ENTERPRISE"]).notNull(),
  status: varchar("status", { length: 64 }).notNull(), // active, past_due, canceled, etc.
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ============================================================================
// MIDDLEMAN BRIDGE TABLES
// ----------------------------------------------------------------------------
// The middleman bridge model: implant UID -> user -> Stripe Customer ->
// Stripe-saved PaymentMethod -> off-session PaymentIntent. Vearch never sees
// the PAN; Stripe is the processor of record. See LEGAL.md.
// ============================================================================

/**
 * PaymentMethods table: read-only mirror of the Stripe PaymentMethods a user
 * has saved on their Stripe Customer. We never store PAN or CVV — only the
 * Stripe id and display metadata (brand + last4 + exp). Source of truth is
 * Stripe; this row is kept in sync via the `payment_method.attached` and
 * `payment_method.detached` webhook events.
 */
export const paymentMethods = mysqlTable("paymentMethods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripePaymentMethodId: varchar("stripePaymentMethodId", { length: 256 }).notNull().unique(),
  brand: varchar("brand", { length: 32 }), // visa, mastercard, amex, ...
  last4: varchar("last4", { length: 4 }),
  expMonth: int("expMonth"),
  expYear: int("expYear"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

/**
 * Merchants table: connected-account merchants who can submit charges
 * against an implant UID. Each merchant has a Stripe Connect account id and
 * an API key whose hash is stored here. The plaintext key is shown once at
 * creation and never persisted.
 */
export const merchants = mysqlTable("merchants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  stripeAccountId: varchar("stripeAccountId", { length: 256 }).notNull().unique(),
  /** scrypt-derived hash of the merchant's API key, stored as `scrypt$<salt-hex>$<hash-hex>`. */
  apiKeyHash: varchar("apiKeyHash", { length: 128 }).notNull().unique(),
  /** Public, non-secret prefix used to look up the row before constant-time hash compare. */
  apiKeyPrefix: varchar("apiKeyPrefix", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = typeof merchants.$inferInsert;
