import { getDb } from "../db";
import { stripeAccounts, InsertStripeAccount } from "../../drizzle/schema";
import { createConnectedAccount, getAccountBalance, getAccountDetails } from "./stripeService";
import { eq } from "drizzle-orm";

/**
 * Bank Service: Handles user account management and Stripe integration
 */

/**
 * Create a bank account for a user (creates Stripe Connected Account)
 */
export async function createBankAccount(
  userId: number,
  email: string,
  name: string
): Promise<{ stripeAccountId: string; onboardingUrl: string }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if user already has a Stripe account
    const existing = await db
      .select()
      .from(stripeAccounts)
      .where(eq(stripeAccounts.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Bank] User ${userId} already has Stripe account: ${existing[0].stripeAccountId}`);
      return {
        stripeAccountId: existing[0].stripeAccountId,
        onboardingUrl: existing[0].onboardingUrl || "",
      };
    }

    // Create Stripe Connected Account
    const { accountId, onboardingUrl } = await createConnectedAccount(userId, email, name);

    // Store in database
    await db.insert(stripeAccounts).values({
      userId,
      stripeAccountId: accountId,
      status: "pending",
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

    const stripeDetails = await getAccountDetails(account[0].stripeAccountId);
    const balance = await getAccountBalance(account[0].stripeAccountId);

    return {
      ...account[0],
      stripeDetails,
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
    const account = await getUserBankAccount(userId);
    if (!account) return 0;

    return account.balance || 0;
  } catch (error) {
    console.error("[Bank] Failed to get user balance:", error);
    return 0;
  }
}

/**
 * Check if user has completed Stripe onboarding
 */
export async function isUserOnboarded(userId: number): Promise<boolean> {
  try {
    const account = await getUserBankAccount(userId);
    if (!account) return false;

    return account.status === "active" && account.chargesEnabled && account.payoutsEnabled;
  } catch (error) {
    console.error("[Bank] Failed to check onboarding status:", error);
    return false;
  }
}
