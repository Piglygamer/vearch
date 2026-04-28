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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Implants table: Tracks NFC/payment implants linked to users.
 * Stores implant identity, NxtPay token reference, and lifecycle status.
 */
export const implants = mysqlTable("implants", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  implantId: varchar("implantId", { length: 128 }).notNull().unique(), // Unique identifier for the physical implant
  implantType: varchar("implantType", { length: 64 }).notNull(), // e.g., "NxtPay", "Apex Flex"
  nxtpayTokenId: varchar("nxtpayTokenId", { length: 256 }), // Reference to NxtPay backend token
  status: mysqlEnum("status", ["active", "expiring", "expired", "revoked"]).default("active").notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // When the NxtPay token expires (2028)
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
  expiryMonth: int("expiryMonth").notNull(), // 1-12
  expiryYear: int("expiryYear").notNull(), // e.g., 30979
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
