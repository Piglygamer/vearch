import { eq, and, lt, gte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  Implant, InsertImplant, implants,
  Token, InsertToken, tokens,
  Card, InsertCard, cards,
  Wallet, InsertWallet, wallets,
  Transaction, InsertTransaction, transactions,
  TokenReprovisioningLog, InsertTokenReprovisioningLog, tokenReprovisioningLog,
  SystemHealth, InsertSystemHealth, systemHealth
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// IMPLANT MANAGEMENT
// ============================================================================

export async function createImplant(implant: InsertImplant): Promise<Implant> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(implants).values(implant);
  const id = result[0].insertId;
  const created = await db.select().from(implants).where(eq(implants.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to create implant");
  return created[0];
}

export async function getImplantsByUserId(userId: number): Promise<Implant[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(implants).where(eq(implants.userId, userId));
}

export async function getImplantById(implantId: number): Promise<Implant | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(implants).where(eq(implants.id, implantId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateImplantStatus(implantId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(implants).set({ status: status as any, updatedAt: new Date() }).where(eq(implants.id, implantId));
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export async function createToken(token: InsertToken): Promise<Token> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tokens).values(token);
  const id = result[0].insertId;
  const created = await db.select().from(tokens).where(eq(tokens.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to create token");
  return created[0];
}

export async function getTokensByImplantId(implantId: number): Promise<Token[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tokens).where(eq(tokens.implantId, implantId)).orderBy(desc(tokens.createdAt));
}

export async function getActiveTokenByImplantId(implantId: number): Promise<Token | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tokens)
    .where(and(eq(tokens.implantId, implantId), eq(tokens.status, "active")))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getExpiringTokens(daysUntilExpiry: number = 30): Promise<Token[]> {
  const db = await getDb();
  if (!db) return [];
  
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);
  
  return db.select().from(tokens)
    .where(and(
      eq(tokens.status, "active"),
      lt(tokens.expiresAt, expiryThreshold),
      gte(tokens.expiresAt, new Date())
    ));
}

export async function updateTokenStatus(tokenId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(tokens).set({ status: status as any, updatedAt: new Date() }).where(eq(tokens.id, tokenId));
}

// ============================================================================
// CARD MANAGEMENT
// ============================================================================

export async function createCard(card: InsertCard): Promise<Card> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(cards).values(card);
  const id = result[0].insertId;
  const created = await db.select().from(cards).where(eq(cards.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to create card");
  return created[0];
}

export async function getCardsByUserId(userId: number): Promise<Card[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cards).where(eq(cards.userId, userId)).orderBy(desc(cards.createdAt));
}

export async function getCardById(cardId: number): Promise<Card | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCardStatus(cardId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(cards).set({ status: status as any, updatedAt: new Date() }).where(eq(cards.id, cardId));
}

// ============================================================================
// WALLET MANAGEMENT
// ============================================================================

export async function createWallet(wallet: InsertWallet): Promise<Wallet> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(wallets).values(wallet);
  const id = result[0].insertId;
  const created = await db.select().from(wallets).where(eq(wallets.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to create wallet");
  return created[0];
}

export async function getWalletsByUserId(userId: number): Promise<Wallet[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wallets).where(eq(wallets.userId, userId));
}

export async function getWalletById(walletId: number): Promise<Wallet | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWalletBalance(walletId: number, newBalance: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(wallets).set({ balance: newBalance as any, updatedAt: new Date() }).where(eq(wallets.id, walletId));
}

// ============================================================================
// TRANSACTION LOGGING
// ============================================================================

export async function createTransaction(transaction: InsertTransaction): Promise<Transaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(transaction);
  const id = result[0].insertId;
  const created = await db.select().from(transactions).where(eq(transactions.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to create transaction");
  return created[0];
}

export async function getTransactionsByUserId(userId: number, limit: number = 50): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

// ============================================================================
// TOKEN RE-PROVISIONING
// ============================================================================

export async function logTokenReprovisioning(log: InsertTokenReprovisioningLog): Promise<TokenReprovisioningLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tokenReprovisioningLog).values(log);
  const id = result[0].insertId;
  const created = await db.select().from(tokenReprovisioningLog).where(eq(tokenReprovisioningLog.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to log reprovisioning");
  return created[0];
}

export async function getReprovisioningLogByImplantId(implantId: number): Promise<TokenReprovisioningLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tokenReprovisioningLog)
    .where(eq(tokenReprovisioningLog.implantId, implantId))
    .orderBy(desc(tokenReprovisioningLog.createdAt));
}

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

export async function logSystemHealth(health: InsertSystemHealth): Promise<SystemHealth> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(systemHealth).values(health);
  const id = result[0].insertId;
  const created = await db.select().from(systemHealth).where(eq(systemHealth.id, Number(id))).limit(1);
  if (!created.length) throw new Error("Failed to log system health");
  return created[0];
}

export async function getRecentSystemHealth(limit: number = 20): Promise<SystemHealth[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemHealth)
    .orderBy(desc(systemHealth.createdAt))
    .limit(limit);
}

export async function getCriticalSystemIssues(): Promise<SystemHealth[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemHealth)
    .where(eq(systemHealth.status, "critical"))
    .orderBy(desc(systemHealth.createdAt));
}
