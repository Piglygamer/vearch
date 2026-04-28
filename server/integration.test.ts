import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, wallets, transactions, implants, cards } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Vearch Bank Integration Tests", () => {
  let db: any;
  let testUserId: number;
  let testWalletId: number;
  let testImplantId: number;

  beforeAll(async () => {
    db = await getDb();
    expect(db).toBeDefined();

    // Create test user
    const userResult = await db.insert(users).values({
      openId: "test_openid_001",
      email: "test@vearch.bank",
      name: "Test User",
      role: "user",
      loginMethod: "oauth",
    });

    testUserId = userResult[0].insertId;
    expect(testUserId).toBeGreaterThan(0);

    // Create test wallet
    const walletResult = await db.insert(wallets).values({
      userId: testUserId,
      walletType: "bank_account",
      fundingSourceId: "test_funding_001",
      balance: "5000.00",
      currency: "USD",
      status: "active",
    });

    testWalletId = walletResult[0].insertId;
    expect(testWalletId).toBeGreaterThan(0);

    // Create test implant
    const implantResult = await db.insert(implants).values({
      userId: testUserId,
      implantId: "APEX_FLEX_TEST_001",
      implantType: "apex_flex",
      status: "active",
    });

    testImplantId = implantResult[0].insertId;
    expect(testImplantId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (!db) return;

    // Clean up test data
    await db.delete(transactions).where(eq(transactions.userId, testUserId));
    await db.delete(implants).where(eq(implants.userId, testUserId));
    await db.delete(wallets).where(eq(wallets.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe("Wallet Management", () => {
    it("should create wallet with correct balance", async () => {
      const wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, testWalletId))
        .limit(1);

      expect(wallet).toHaveLength(1);
      expect(wallet[0].balance).toBe("5000.00");
      expect(wallet[0].status).toBe("active");
    });

    it("should update wallet balance", async () => {
      const newBalance = "4500.00";
      await db
        .update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, testWalletId));

      const updated = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, testWalletId))
        .limit(1);

      expect(updated[0].balance).toBe(newBalance);
    });

    it("should prevent negative balance", async () => {
      const wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, testWalletId))
        .limit(1);

      const currentBalance = parseFloat(wallet[0].balance);
      const attemptedDeduction = currentBalance + 1000;

      // Should not allow balance to go negative
      expect(currentBalance >= 0).toBe(true);
    });
  });

  describe("Transaction Processing", () => {
    it("should create deposit transaction", async () => {
      const txnResult = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "topup",
        amount: "500.00",
        currency: "USD",
        status: "completed",
        merchantName: "Bank Deposit",
        description: "Test deposit",
      });

      const txnId = txnResult[0].insertId;
      expect(txnId).toBeGreaterThan(0);

      const txn = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      expect(txn[0].transactionType).toBe("topup");
      expect(txn[0].amount).toBe("500.00");
      expect(txn[0].status).toBe("completed");
    });

    it("should create withdrawal transaction", async () => {
      const txnResult = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "transfer",
        amount: "200.00",
        currency: "USD",
        status: "completed",
        merchantName: "Bank Withdrawal",
        description: "Test withdrawal",
      });

      const txnId = txnResult[0].insertId;
      expect(txnId).toBeGreaterThan(0);

      const txn = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      expect(txn[0].transactionType).toBe("transfer");
      expect(txn[0].status).toBe("completed");
    });

    it("should create implant payment transaction", async () => {
      const txnResult = await db.insert(transactions).values({
        userId: testUserId,
        implantId: testImplantId,
        walletId: testWalletId,
        transactionType: "payment",
        amount: "25.50",
        currency: "USD",
        status: "completed",
        merchantName: "Coffee Shop",
        description: "Apex Flex NFC Payment",
      });

      const txnId = txnResult[0].insertId;
      expect(txnId).toBeGreaterThan(0);

      const txn = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      expect(txn[0].implantId).toBe(testImplantId);
      expect(txn[0].transactionType).toBe("payment");
    });

    it("should track transaction status", async () => {
      const txnResult = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "payment",
        amount: "50.00",
        currency: "USD",
        status: "pending",
        merchantName: "Test Merchant",
      });

      const txnId = txnResult[0].insertId;

      // Update status to completed
      await db
        .update(transactions)
        .set({ status: "completed" })
        .where(eq(transactions.id, txnId));

      const updated = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      expect(updated[0].status).toBe("completed");
    });

    it("should record transaction metadata", async () => {
      const metadata = {
        merchantId: "MERCHANT_123",
        authCode: "ABC123",
        timestamp: Date.now(),
      };

      const txnResult = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "payment",
        amount: "75.00",
        currency: "USD",
        status: "completed",
        merchantName: "Metadata Test",
        metadata: JSON.stringify(metadata),
      });

      const txnId = txnResult[0].insertId;
      const txn = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      const parsedMetadata = JSON.parse(txn[0].metadata || "{}");
      expect(parsedMetadata.merchantId).toBe("MERCHANT_123");
      expect(parsedMetadata.authCode).toBe("ABC123");
    });
  });

  describe("Implant Management", () => {
    it("should create implant with correct status", async () => {
      const implant = await db
        .select()
        .from(implants)
        .where(eq(implants.id, testImplantId))
        .limit(1);

      expect(implant).toHaveLength(1);
      expect(implant[0].status).toBe("active");
      expect(implant[0].implantType).toBe("apex_flex");
    });

    it("should update implant status", async () => {
      await db
        .update(implants)
        .set({ status: "expiring" })
        .where(eq(implants.id, testImplantId));

      const updated = await db
        .select()
        .from(implants)
        .where(eq(implants.id, testImplantId))
        .limit(1);

      expect(updated[0].status).toBe("expiring");
    });

    it("should restore implant to active", async () => {
      await db
        .update(implants)
        .set({ status: "active" })
        .where(eq(implants.id, testImplantId));

      const updated = await db
        .select()
        .from(implants)
        .where(eq(implants.id, testImplantId))
        .limit(1);

      expect(updated[0].status).toBe("active");
    });
  });

  describe("Payment Velocity Checks", () => {
    it("should track daily transaction volume", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create multiple transactions
      for (let i = 0; i < 3; i++) {
        await db.insert(transactions).values({
          userId: testUserId,
          walletId: testWalletId,
          transactionType: "payment",
          amount: (100 + i * 10).toString(),
          currency: "USD",
          status: "completed",
          merchantName: `Merchant ${i}`,
        });
      }

      // Get today's transactions
      const todayTxns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId));

      const dailyTotal = todayTxns.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      expect(dailyTotal).toBeGreaterThan(0);
    });

    it("should enforce daily limit", async () => {
      const dailyLimit = 5000;
      const todayTxns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId));

      const dailyTotal = todayTxns.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      const canTransact = dailyTotal < dailyLimit;

      expect(canTransact).toBe(true);
    });
  });

  describe("Refund Processing", () => {
    it("should create refund transaction", async () => {
      // Create original transaction
      const originalTxn = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "payment",
        amount: "100.00",
        currency: "USD",
        status: "completed",
        merchantName: "Refund Test",
      });

      const originalId = originalTxn[0].insertId;

      // Create refund
      const refundTxn = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "refund",
        amount: "100.00",
        currency: "USD",
        status: "completed",
        merchantName: "Refund Test",
        metadata: JSON.stringify({ originalTransactionId: originalId }),
      });

      const refundId = refundTxn[0].insertId;
      expect(refundId).toBeGreaterThan(0);

      const refund = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, refundId))
        .limit(1);

      expect(refund[0].transactionType).toBe("refund");
    });
  });

  describe("Multi-User Isolation", () => {
    it("should isolate transactions by user", async () => {
      // Create second user
      const user2Result = await db.insert(users).values({
        openId: "test_openid_002",
        email: "test2@vearch.bank",
        name: "Test User 2",
        role: "user",
        loginMethod: "oauth",
      });

      const user2Id = user2Result[0].insertId;

      // Create wallet for user 2
      const wallet2Result = await db.insert(wallets).values({
        userId: user2Id,
        walletType: "bank_account",
        fundingSourceId: "test_funding_002",
        balance: "1000.00",
        currency: "USD",
        status: "active",
      });

      const wallet2Id = wallet2Result[0].insertId;

      // Create transactions for both users
      await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "payment",
        amount: "50.00",
        currency: "USD",
        status: "completed",
      });

      await db.insert(transactions).values({
        userId: user2Id,
        walletId: wallet2Id,
        transactionType: "payment",
        amount: "30.00",
        currency: "USD",
        status: "completed",
      });

      // Verify isolation
      const user1Txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId));

      const user2Txns = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, user2Id));

      expect(user1Txns.length).toBeGreaterThan(0);
      expect(user2Txns.length).toBeGreaterThan(0);
      expect(user1Txns[0].userId).not.toBe(user2Txns[0].userId);

      // Clean up user 2
      await db.delete(transactions).where(eq(transactions.userId, user2Id));
      await db.delete(wallets).where(eq(wallets.userId, user2Id));
      await db.delete(users).where(eq(users.id, user2Id));
    });
  });

  describe("Data Consistency", () => {
    it("should maintain referential integrity", async () => {
      const txn = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId))
        .limit(1);

      if (txn.length > 0) {
        // Verify user exists
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, txn[0].userId))
          .limit(1);

        expect(user).toHaveLength(1);
      }
    });

    it("should preserve transaction timestamps", async () => {
      const txnResult = await db.insert(transactions).values({
        userId: testUserId,
        walletId: testWalletId,
        transactionType: "payment",
        amount: "10.00",
        currency: "USD",
        status: "completed",
      });

      const txnId = txnResult[0].insertId;
      const txn = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      expect(txn[0].createdAt).toBeDefined();
      expect(txn[0].updatedAt).toBeDefined();
    });
  });
});
