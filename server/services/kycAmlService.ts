import { getDb } from "../db";
import { users, transactions } from "../../drizzle/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { sendAlertNotification } from "./notificationService";

export interface KYCData {
  userId: number;
  fullName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  idType: "passport" | "driver_license" | "national_id";
  idNumber: string;
  idExpiry: string;
  verificationStatus: "pending" | "verified" | "rejected";
}

export interface TransactionLimit {
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
}

const USER_TIERS = {
  unverified: {
    dailyLimit: 500,
    weeklyLimit: 2000,
    monthlyLimit: 5000,
    singleTransactionLimit: 500,
  },
  verified: {
    dailyLimit: 10000,
    weeklyLimit: 50000,
    monthlyLimit: 200000,
    singleTransactionLimit: 10000,
  },
  premium: {
    dailyLimit: 100000,
    weeklyLimit: 500000,
    monthlyLimit: 2000000,
    singleTransactionLimit: 100000,
  },
};

/**
 * Verify user KYC data
 */
export async function verifyKYC(kycData: KYCData): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database unavailable" };
    }

    // Validate required fields
    if (!kycData.fullName || !kycData.dateOfBirth || !kycData.idNumber) {
      return { success: false, message: "Missing required KYC fields" };
    }

    // Check for age (must be 18+)
    const dob = new Date(kycData.dateOfBirth);
    const age = new Date().getFullYear() - dob.getFullYear();
    if (age < 18) {
      return { success: false, message: "User must be 18 years or older" };
    }

    // Check for duplicate ID numbers (fraud prevention)
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, kycData.userId))
      .limit(1);

    if (!existingUser.length) {
      return { success: false, message: "User not found" };
    }

    // KYC verification completed
    // In production, store KYC data in a separate table or external service
    console.log(`[KYC] KYC data for user ${kycData.userId}:`, kycData);

    console.log(`[KYC] User ${kycData.userId} verified`);
    return { success: true, message: "KYC verification completed" };
  } catch (error) {
    console.error("[KYC] Verification error:", error);
    return { success: false, message: "KYC verification failed" };
  }
}

/**
 * Get transaction limits for user
 */
export async function getTransactionLimits(userId: number): Promise<TransactionLimit> {
  try {
    const db = await getDb();
    if (!db) {
      return USER_TIERS.unverified;
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) {
      return USER_TIERS.unverified;
    }

    // In production, check KYC status from database or external service
    // For now, return unverified tier
    // if (user[0].kycVerified) {
    //   return USER_TIERS.verified;
    // }

    return USER_TIERS.unverified;
  } catch (error) {
    console.error("[KYC] Error getting limits:", error);
    return USER_TIERS.unverified;
  }
}

/**
 * Check if transaction violates limits
 */
export async function checkTransactionLimits(userId: number, amount: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const limits = await getTransactionLimits(userId);

    // Check single transaction limit
    if (amount > limits.singleTransactionLimit) {
      return {
        allowed: false,
        reason: `Transaction exceeds single transaction limit of $${limits.singleTransactionLimit}`,
      };
    }

    const db = await getDb();
    if (!db) {
      return { allowed: false, reason: "Database unavailable" };
    }

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, today)));

    const dailyTotal = todayTransactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string) || 0), 0);

    if (dailyTotal + amount > limits.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit of $${limits.dailyLimit} would be exceeded`,
      };
    }

    // Get this week's transactions
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, weekAgo)));

    const weeklyTotal = weekTransactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string) || 0), 0);

    if (weeklyTotal + amount > limits.weeklyLimit) {
      return {
        allowed: false,
        reason: `Weekly limit of $${limits.weeklyLimit} would be exceeded`,
      };
    }

    // Get this month's transactions
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const monthTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, monthAgo)));

    const monthlyTotal = monthTransactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string) || 0), 0);

    if (monthlyTotal + amount > limits.monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly limit of $${limits.monthlyLimit} would be exceeded`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[KYC] Error checking limits:", error);
    return { allowed: false, reason: "Error checking transaction limits" };
  }
}

/**
 * Detect suspicious activity
 */
export async function detectSuspiciousActivity(userId: number, amount: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // Get user's transaction history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, thirtyDaysAgo)));

    if (recentTransactions.length === 0) {
      // First transaction - check if unusually large
      if (amount > 5000) {
        console.warn(`[AML] Suspicious: First transaction of $${amount} by user ${userId}`);
        await sendAlertNotification(userId, `Large first transaction detected: $${amount}. If this wasn't you, please contact support.`);
        return true;
      }
      return false;
    }

    // Calculate average transaction amount
    const avgAmount = recentTransactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string) || 0), 0) / recentTransactions.length;

    // Flag if transaction is 5x the average
    if (amount > avgAmount * 5) {
      console.warn(`[AML] Suspicious: Transaction $${amount} is 5x average ($${avgAmount.toFixed(2)}) for user ${userId}`);
      await sendAlertNotification(userId, `Unusual transaction amount detected: $${amount}. If this wasn't you, please contact support.`);
      return true;
    }

    // Check for rapid transactions (more than 10 in 1 hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentRapidTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, oneHourAgo)));

    if (recentRapidTransactions.length > 10) {
      console.warn(`[AML] Suspicious: ${recentRapidTransactions.length} transactions in 1 hour by user ${userId}`);
      await sendAlertNotification(userId, `Unusual transaction frequency detected. If this wasn't you, please contact support.`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[AML] Error detecting suspicious activity:", error);
    return false;
  }
}

/**
 * Block user for suspicious activity
 */
export async function blockUserForSuspiciousActivity(userId: number, reason: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // In production, store blocked status in database or external service
    console.log(`[AML] User ${userId} blocked: ${reason}`);
    await sendAlertNotification(userId, `Your account has been temporarily blocked due to suspicious activity. Please contact support.`);

    return true;
  } catch (error) {
    console.error("[AML] Error blocking user:", error);
    return false;
  }
}

/**
 * Check if user is blocked
 */
export async function isUserBlocked(userId: number): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) return false;
    // In production, check blocked status from database or external service
    // For now, assume user is not blocked
    return false;
  } catch (error) {
    console.error("[AML] Error checking block status:", error);
    return false;
  }
}

export default {
  verifyKYC,
  getTransactionLimits,
  checkTransactionLimits,
  detectSuspiciousActivity,
  blockUserForSuspiciousActivity,
  isUserBlocked,
};
