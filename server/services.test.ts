import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, wallets, transactions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  verifyKYC,
  getTransactionLimits,
  checkTransactionLimits,
  detectSuspiciousActivity,
  isUserBlocked,
} from "./services/kycAmlService";

describe("KYC/AML Service", () => {
  let testUserId: number;
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const testEmail = `test-kyc-${Date.now()}@example.com`;
    await db.insert(users).values({
      openId: `test-kyc-${Date.now()}`,
      name: "Test User",
      email: testEmail,
      loginMethod: "test",
      role: "user",
    });

    const createdUsers = await db.select().from(users).where(eq(users.email, testEmail));
    testUserId = createdUsers[0]?.id || 1;
  });

  afterAll(async () => {
    if (db && testUserId) {
      await db.delete(transactions).where(eq(transactions.userId, testUserId));
      await db.delete(wallets).where(eq(wallets.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should verify KYC data", async () => {
    const result = await verifyKYC({
      userId: testUserId,
      fullName: "John Doe",
      dateOfBirth: "1990-01-01",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "US",
      idType: "passport",
      idNumber: "123456789",
      idExpiry: "2030-01-01",
      verificationStatus: "verified",
    });

    expect(result.success).toBe(true);
  });

  it("should reject KYC for underage user", async () => {
    const result = await verifyKYC({
      userId: testUserId,
      fullName: "Young User",
      dateOfBirth: "2010-01-01",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "US",
      idType: "passport",
      idNumber: "987654321",
      idExpiry: "2030-01-01",
      verificationStatus: "pending",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("18 years");
  });

  it("should get transaction limits for unverified user", async () => {
    const limits = await getTransactionLimits(testUserId);

    expect(limits.dailyLimit).toBe(500);
    expect(limits.weeklyLimit).toBe(2000);
    expect(limits.monthlyLimit).toBe(5000);
    expect(limits.singleTransactionLimit).toBe(500);
  });

  it("should allow transaction within limits", async () => {
    const result = await checkTransactionLimits(testUserId, 100);

    expect(result.allowed).toBe(true);
  });

  it("should reject transaction exceeding single limit", async () => {
    const result = await checkTransactionLimits(testUserId, 1000);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("single transaction limit");
  });

  it("should detect suspicious activity for large first transaction", async () => {
    const isSuspicious = await detectSuspiciousActivity(testUserId, 6000);

    expect(isSuspicious).toBe(true);
  });

  it("should not flag user as blocked initially", async () => {
    const blocked = await isUserBlocked(testUserId);

    expect(blocked).toBe(false);
  });
});

describe("Notification Service", () => {
  it("should have notification functions available", async () => {
    const { sendEmailNotification, sendPushNotification, sendTransactionReceipt } = await import("./services/notificationService");

    expect(typeof sendEmailNotification).toBe("function");
    expect(typeof sendPushNotification).toBe("function");
    expect(typeof sendTransactionReceipt).toBe("function");
  });
});

describe("PayPal Webhook Handler", () => {
  it("should handle webhook events", async () => {
    const webhookRouter = await import("../server/webhooks/paypal");

    expect(webhookRouter).toBeDefined();
  });
});
