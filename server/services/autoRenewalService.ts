/**
 * Auto-Renewal Service
 * Automatically renews cards and implants before expiration
 * Ensures continuous operation and prevents service interruption
 */

import { getDb } from "../db";
import { cards, implants, transactions, wallets } from "../../drizzle/schema";
import { eq, lt, and } from "drizzle-orm";
import { getStripeClient } from "./stripeService";

interface RenewalResult {
  success: boolean;
  itemId: string;
  itemType: "card" | "implant";
  newExpiryDate: Date;
  message: string;
  timestamp: Date;
}

const RENEWAL_THRESHOLD_DAYS = 30; // Renew 30 days before expiry
const RENEWAL_COST = 9.99; // $9.99 per renewal
const RENEWAL_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check daily

let renewalScheduleId: NodeJS.Timeout | null = null;

/**
 * Start auto-renewal service
 */
export async function startAutoRenewalService(intervalMs: number = RENEWAL_INTERVAL_MS): Promise<void> {
  console.log("[AutoRenewal] Service started");

  // Run immediately on startup
  await performRenewalCheck();

  // Schedule recurring checks
  renewalScheduleId = setInterval(async () => {
    try {
      await performRenewalCheck();
    } catch (error) {
      console.error("[AutoRenewal] Renewal check failed:", error);
    }
  }, intervalMs);
}

/**
 * Stop auto-renewal service
 */
export function stopAutoRenewalService(): void {
  if (renewalScheduleId) {
    clearInterval(renewalScheduleId);
    renewalScheduleId = null;
    console.log("[AutoRenewal] Service stopped");
  }
}

/**
 * Perform renewal check
 */
async function performRenewalCheck(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[AutoRenewal] Database unavailable");
      return;
    }

    // Check cards for renewal
    const cardsToRenew = await getCardsNeedingRenewal(db);
    for (const card of cardsToRenew) {
      await renewCard(db, card);
    }

    // Check implants for renewal
    const implantsToRenew = await getImplantsNeedingRenewal(db);
    for (const implant of implantsToRenew) {
      await renewImplant(db, implant);
    }

    if (cardsToRenew.length > 0 || implantsToRenew.length > 0) {
      console.log(`[AutoRenewal] Renewed ${cardsToRenew.length} cards and ${implantsToRenew.length} implants`);
    }
  } catch (error) {
    console.error("[AutoRenewal] Renewal check error:", error);
  }
}

/**
 * Get cards needing renewal
 */
async function getCardsNeedingRenewal(db: any): Promise<any[]> {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + RENEWAL_THRESHOLD_DAYS);

  // Cards don't have expiryDate in schema, they use expiryMonth/expiryYear
  // For now, return empty array as card renewal logic needs redesign
  return [];
}

/**
 * Get implants needing renewal
 */
async function getImplantsNeedingRenewal(db: any): Promise<any[]> {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + RENEWAL_THRESHOLD_DAYS);

  const implantsToRenew = await db
    .select()
    .from(implants)
    .where(
      and(
        eq(implants.status, "active"),
        lt(implants.expiresAt, thresholdDate)
      )
    );

  return implantsToRenew;
}

/**
 * Renew a card
 */
async function renewCard(db: any, card: any): Promise<RenewalResult> {
  try {
    // Calculate new expiry date (2 years from now)
    const newExpiryDate = new Date();
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 2);
    const newExpiryMonth = newExpiryDate.getMonth() + 1;
    const newExpiryYear = newExpiryDate.getFullYear();

    // Charge renewal fee from wallet
    const walletRecord = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, card.userId))
      .limit(1);

    if (!walletRecord || walletRecord.length === 0) {
      return {
        success: false,
        itemId: card.id.toString(),
        itemType: "card",
        newExpiryDate,
        message: "Wallet not found",
        timestamp: new Date(),
      };
    }

    const wallet = walletRecord[0];
    const currentBalance = parseFloat(wallet.balance.toString());

    if (currentBalance < RENEWAL_COST) {
      return {
        success: false,
        itemId: card.id.toString(),
        itemType: "card",
        newExpiryDate,
        message: "Insufficient balance for renewal",
        timestamp: new Date(),
      };
    }

    // Deduct from wallet
    const newBalance = (currentBalance - RENEWAL_COST).toFixed(2);
    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet.id));

    // Update card expiry
    await db
      .update(cards)
      .set({
        expiryMonth: newExpiryMonth,
        expiryYear: newExpiryYear,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, card.id));

    // Log renewal transaction
    await db.insert(transactions).values({
      userId: card.userId,
      cardId: card.id,
      walletId: wallet.id,
      transactionType: "payment",
      amount: RENEWAL_COST.toString(),
      currency: "USD",
      status: "completed",
      merchantName: "Vearch Bank",
      description: "Card Renewal Fee",
      metadata: JSON.stringify({
        renewalType: "card",
        cardId: card.id,
      }),
    });

    return {
      success: true,
      itemId: card.id.toString(),
      itemType: "card",
      newExpiryDate,
      message: "Card renewed successfully",
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      itemId: card.id.toString(),
      itemType: "card",
      newExpiryDate: new Date(),
      message: `Renewal failed: ${errorMessage}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Renew an implant
 */
async function renewImplant(db: any, implant: any): Promise<RenewalResult> {
  try {
    // Calculate new expiry date (5 years from now - implants last longer)
    const newExpiryDate = new Date();
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 5);

    // Charge renewal fee from wallet
    const walletRecord = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, implant.userId))
      .limit(1);

    if (!walletRecord || walletRecord.length === 0) {
      return {
        success: false,
        itemId: implant.id.toString(),
        itemType: "implant",
        newExpiryDate,
        message: "Wallet not found",
        timestamp: new Date(),
      };
    }

    const wallet = walletRecord[0];
    const renewalCost = RENEWAL_COST * 2; // Implant renewal is 2x card renewal
    const currentBalance = parseFloat(wallet.balance.toString());

    if (currentBalance < renewalCost) {
      return {
        success: false,
        itemId: implant.id.toString(),
        itemType: "implant",
        newExpiryDate,
        message: "Insufficient balance for renewal",
        timestamp: new Date(),
      };
    }

    // Deduct from wallet
    const newBalance = (currentBalance - renewalCost).toFixed(2);
    await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.id, wallet.id));

    // Update implant expiry
    await db
      .update(implants)
      .set({
        expiresAt: newExpiryDate,
        updatedAt: new Date(),
      })
      .where(eq(implants.id, implant.id));

    // Log renewal transaction
    await db.insert(transactions).values({
      userId: implant.userId,
      implantId: implant.id,
      walletId: wallet.id,
      transactionType: "payment",
      amount: (RENEWAL_COST * 2).toString(),
      currency: "USD",
      status: "completed",
      merchantName: "Vearch Bank",
      description: "Implant Renewal Fee",
      metadata: JSON.stringify({
        renewalType: "implant",
        implantId: implant.id,
      }),
    });

    return {
      success: true,
      itemId: implant.id.toString(),
      itemType: "implant",
      newExpiryDate,
      message: "Implant renewed successfully",
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      itemId: implant.id.toString(),
      itemType: "implant",
      newExpiryDate: new Date(),
      message: `Renewal failed: ${errorMessage}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Get renewal history
 */
export async function getRenewalHistory(): Promise<RenewalResult[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const renewalTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.description, "Card Renewal Fee"));

    return renewalTransactions.map((t: any) => ({
      success: t.status === "completed",
      itemId: t.cardId?.toString() || t.implantId?.toString() || "",
      itemType: t.cardId ? "card" : "implant",
      newExpiryDate: new Date(),
      message: `${t.status} - ${t.amount} ${t.currency}`,
      timestamp: t.createdAt,
    }));
  } catch (error) {
    console.error("[AutoRenewal] Failed to get history:", error);
    return [];
  }
}

/**
 * Manually trigger renewal for a card
 */
export async function manualRenewCard(cardId: number): Promise<RenewalResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        itemId: cardId.toString(),
        itemType: "card",
        newExpiryDate: new Date(),
        message: "Database unavailable",
        timestamp: new Date(),
      };
    }

    const cardRecord = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
    if (!cardRecord || cardRecord.length === 0) {
      return {
        success: false,
        itemId: cardId.toString(),
        itemType: "card",
        newExpiryDate: new Date(),
        message: "Card not found",
        timestamp: new Date(),
      };
    }

    return renewCard(db, cardRecord[0]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      itemId: cardId.toString(),
      itemType: "card",
      newExpiryDate: new Date(),
      message: `Manual renewal failed: ${errorMessage}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Manually trigger renewal for an implant
 */
export async function manualRenewImplant(implantId: number): Promise<RenewalResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        itemId: implantId.toString(),
        itemType: "implant",
        newExpiryDate: new Date(),
        message: "Database unavailable",
        timestamp: new Date(),
      };
    }

    const implantRecord = await db.select().from(implants).where(eq(implants.id, implantId)).limit(1);
    if (!implantRecord || implantRecord.length === 0) {
      return {
        success: false,
        itemId: implantId.toString(),
        itemType: "implant",
        newExpiryDate: new Date(),
        message: "Implant not found",
        timestamp: new Date(),
      };
    }

    return renewImplant(db, implantRecord[0]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      itemId: implantId.toString(),
      itemType: "implant",
      newExpiryDate: new Date(),
      message: `Manual renewal failed: ${errorMessage}`,
      timestamp: new Date(),
    };
  }
}

export default {
  startAutoRenewalService,
  stopAutoRenewalService,
  performRenewalCheck,
  getRenewalHistory,
  manualRenewCard,
  manualRenewImplant,
};
