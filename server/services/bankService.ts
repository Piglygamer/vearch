import { getDb } from "../db";
import { stripeAccounts, InsertStripeAccount, wallets } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Bank Service: Handles user account management
 */

/**
 * Create a bank account for a user
 */
export async function createBankAccount(
  userId: number,
  email: string,
  name: string
): Promise<{ stripeAccountId: string; onboardingUrl: string }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if user already has a bank account
    const existing = await db
      .select()
      .from(stripeAccounts)
      .where(eq(stripeAccounts.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Bank] User ${userId} already has bank account: ${existing[0].stripeAccountId}`);
      return {
        stripeAccountId: existing[0].stripeAccountId,
        onboardingUrl: existing[0].onboardingUrl || "",
      };
    }

    // Generate mock account ID
    const accountId = `acct_${Date.now()}_${userId}`;
    const onboardingUrl = "https://dashboard.stripe.com/account/onboarding";

    // Store in database
    await db.insert(stripeAccounts).values({
      userId,
      stripeAccountId: accountId,
      status: "active",
      onboardingUrl,
    } as InsertStripeAccount);

    console.log(`[Bank] Created bank account for user ${userId}: ${accountId}`);

    return { stripeAccountId: accountId, onboardingUrl };
  } catch (error) {
    console.error("[Bank] Failed to create bank account:", error);
    throw error;
  }
}

/**
 * Get user's bank account details
 */
export async function getUserBankAccount(userId: number): Promise<any> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const account = await db
      .select()
      .from(stripeAccounts)
      .where(eq(stripeAccounts.userId, userId))
      .limit(1);

    if (account.length === 0) {
      return null;
    }

    // Get wallet balance
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    const balance = wallet.length > 0 ? parseFloat(wallet[0].balance.toString()) : 0;

    return {
      ...account[0],
      balance,
    };
  } catch (error) {
    console.error("[Bank] Failed to get user bank account:", error);
    throw error;
  }
}

/**
 * Update bank account status
 */
export async function updateBankAccountStatus(
  userId: number,
  status: "pending" | "active" | "restricted" | "suspended",
  chargesEnabled?: boolean,
  payoutsEnabled?: boolean
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const updateData: any = { status };
    if (chargesEnabled !== undefined) updateData.chargesEnabled = chargesEnabled;
    if (payoutsEnabled !== undefined) updateData.payoutsEnabled = payoutsEnabled;

    await db
      .update(stripeAccounts)
      .set(updateData)
      .where(eq(stripeAccounts.userId, userId));

    console.log(`[Bank] Updated bank account status for user ${userId}: ${status}`);
  } catch (error) {
    console.error("[Bank] Failed to update bank account status:", error);
    throw error;
  }
}

/**
 * Get user's account balance
 */
export async function getUserBalance(userId: number): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;

    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (wallet.length === 0) return 0;
    return parseFloat(wallet[0].balance.toString());
  } catch (error) {
    console.error("[Bank] Failed to get user balance:", error);
    return 0;
  }
}

/**
 * Check if user has completed onboarding
 */
export async function isUserOnboarded(userId: number): Promise<boolean> {
  try {
    const account = await getUserBankAccount(userId);
    if (!account) return false;

    return account.status === "active";
  } catch (error) {
    console.error("[Bank] Failed to check onboarding status:", error);
    return false;
  }
}
