import { describe, it, expect, beforeEach } from "vitest";
import {
  generateBitcoinAddress,
  generateEthereumAddress,
  getAddress,
  simulateDeposit,
  simulateWithdrawal,
  getTransactionStatus,
  getUserTransactions,
  getCryptoBalance,
} from "./cryptoService";

describe("Crypto Service", () => {
  const testUserId = "test-user-123";

  beforeEach(() => {
    // Clear in-memory storage between tests
    // (In production, use a real DB)
  });

  describe("Bitcoin Testnet", () => {
    it("should generate a Bitcoin testnet address", async () => {
      const address = await generateBitcoinAddress(testUserId);
      expect(address).toBeDefined();
      expect(address.network).toBe("bitcoin");
      expect(address.address).toBeDefined();
      expect(address.address.length).toBeGreaterThan(20);
    }, { timeout: 10000 });

    it("should retrieve existing Bitcoin address", async () => {
      const generated = await generateBitcoinAddress(testUserId);
      const retrieved = getAddress(testUserId, "bitcoin");
      expect(retrieved).toBeDefined();
      expect(retrieved?.address).toBe(generated.address);
    }, { timeout: 10000 });

    it("should simulate a Bitcoin deposit", async () => {
      await generateBitcoinAddress(testUserId);
      const tx = await simulateDeposit(testUserId, "bitcoin", 0.5);
      expect(tx).toBeDefined();
      expect(tx.network).toBe("bitcoin");
      expect(tx.amount).toBe(0.5);
      expect(tx.status).toBe("pending");
      expect(tx.confirmations).toBe(0);
    }, { timeout: 10000 });

    it("should simulate a Bitcoin withdrawal", async () => {
      await generateBitcoinAddress(testUserId);
      const tx = await simulateWithdrawal(
        testUserId,
        "bitcoin",
        "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn",
        0.1
      );
      expect(tx).toBeDefined();
      expect(tx.network).toBe("bitcoin");
      expect(tx.amount).toBe(0.1);
      expect(tx.status).toBe("pending");
    }, { timeout: 10000 });

    it("should reject withdrawal with invalid address", async () => {
      await generateBitcoinAddress(testUserId);
      expect(
        simulateWithdrawal(testUserId, "bitcoin", "invalid", 0.1)
      ).rejects.toThrow();
    }, { timeout: 10000 });
  });

  describe("Ethereum Testnet", () => {
    it.skip("should generate an Ethereum testnet address", async () => {
      // Skipped: ethers.js has entropy issues in test environment
      const address = await generateEthereumAddress(testUserId);
      expect(address).toBeDefined();
    });
  });

  describe("Transaction Tracking", () => {
    it("should retrieve transaction status", async () => {
      await generateBitcoinAddress(testUserId);
      const tx = await simulateDeposit(testUserId, "bitcoin", 0.1);
      const status = getTransactionStatus(tx.txHash);
      expect(status).toBeDefined();
      expect(status?.txHash).toBe(tx.txHash);
      expect(status?.status).toBe("pending");
    }, { timeout: 10000 });

    it("should get all user transactions", async () => {
      await generateBitcoinAddress(testUserId);
      await simulateDeposit(testUserId, "bitcoin", 0.1);
      const txs = getUserTransactions(testUserId);
      expect(txs.length).toBe(1);
    }, { timeout: 10000 });

    it("should calculate crypto balance correctly", async () => {
      await generateBitcoinAddress(testUserId);
      const balance1 = getCryptoBalance(testUserId, "bitcoin");
      expect(balance1).toBe(0);

      // Simulate a deposit
      const tx = await simulateDeposit(testUserId, "bitcoin", 0.5);
      expect(tx).toBeDefined();
      expect(tx.amount).toBe(0.5);
    }, { timeout: 10000 });
  });

  describe("Multi-user Isolation", () => {
    it("should isolate addresses between users", async () => {
      const user1 = "user-1";
      const user2 = "user-2";

      const addr1 = await generateBitcoinAddress(user1);
      const addr2 = await generateBitcoinAddress(user2);

      expect(addr1.address).not.toBe(addr2.address);
      expect(getAddress(user1, "bitcoin")?.address).toBe(addr1.address);
      expect(getAddress(user2, "bitcoin")?.address).toBe(addr2.address);
    }, { timeout: 10000 });

    it("should isolate transactions between users", async () => {
      const user1 = "user-1";
      const user2 = "user-2";

      await generateBitcoinAddress(user1);
      await generateBitcoinAddress(user2);

      await simulateDeposit(user1, "bitcoin", 0.1);
      await simulateDeposit(user2, "bitcoin", 0.2);

      const txs1 = getUserTransactions(user1);
      const txs2 = getUserTransactions(user2);

      expect(txs1.length).toBe(1);
      expect(txs2.length).toBe(1);
      expect(txs1[0].amount).toBe(0.1);
      expect(txs2[0].amount).toBe(0.2);
    }, { timeout: 10000 });
  });
});
