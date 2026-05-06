import { describe, it, expect, beforeEach } from "vitest";
import { paymentEmulatorRouter } from "./paymentEmulator";

// Mock context
const mockCtx = {
  user: {
    id: "test-user-123",
    email: "test@example.com",
    name: "Test User",
  },
};

describe("Payment Emulator Router", () => {
  let cardId: string;

  describe("createCard", () => {
    it("should create a virtual card with never-expire date", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.createCard({ cardholderName: "Test User" });

      expect(result.success).toBe(true);
      expect(result.card).toBeDefined();
      expect(result.card.pan).toMatch(/^\d{16}$/); // 16-digit Luhn-valid PAN
      expect(result.card.cvv).toMatch(/^\d{3}$/); // 3-digit CVV
      expect(result.card.expiry).toBe("07/30979"); // Never expires
      expect(result.card.status).toBe("active");

      cardId = result.card.id;
    });

    it("should generate Luhn-valid PANs", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.createCard({ cardholderName: "Test User" });

      const pan = result.card.pan;
      let sum = 0;
      let isEven = false;

      for (let i = pan.length - 1; i >= 0; i--) {
        let digit = parseInt(pan[i]);

        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
        isEven = !isEven;
      }

      expect(sum % 10).toBe(0); // Luhn check
    });
  });

  describe("getCard", () => {
    beforeEach(async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.createCard({ cardholderName: "Test User" });
      cardId = result.card.id;
    });

    it("should retrieve card details", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.getCard({ cardId });

      expect(result.success).toBe(true);
      expect(result.card.id).toBe(cardId);
      expect(result.card.pan).toMatch(/^\d{16}$/);
      expect(result.card.expiry).toBe("07/30979");
      expect(result.card.balance).toBe(0);
    });

    it("should throw error for non-existent card", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);

      try {
        await caller.getCard({ cardId: "non-existent-id" });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("linkPaymentMethod", () => {
    beforeEach(async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.createCard({ cardholderName: "Test User" });
      cardId = result.card.id;
    });

    it("should link payment method and fund card", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.linkPaymentMethod({
        cardId,
        paymentMethodId: "pm_test_123",
        amount: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.card.balance).toBe(1000);
      expect(result.card.linkedPaymentMethod).toBe("pm_test_123");
    });
  });

  describe("processTransaction", () => {
    beforeEach(async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const createResult = await caller.createCard({ cardholderName: "Test User" });
      cardId = createResult.card.id;

      await caller.linkPaymentMethod({
        cardId,
        paymentMethodId: "pm_test_123",
        amount: 1000,
      });
    });

    it("should process a transaction and deduct from balance", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.processTransaction({
        cardId,
        amount: 25.0,
        merchant: "Starbucks",
        description: "Coffee",
      });

      expect(result.success).toBe(true);
      expect(result.transaction.amount).toBe(25.0);
      expect(result.transaction.merchant).toBe("Starbucks");
      expect(result.transaction.status).toBe("completed");
      expect(result.transaction.newBalance).toBe(975.0);
      expect(result.transaction.authCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it("should reject transaction with insufficient balance", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);

      try {
        await caller.processTransaction({
          cardId,
          amount: 2000.0, // More than balance
          merchant: "Test Merchant",
          description: "Test",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("getTransactions", () => {
    beforeEach(async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const createResult = await caller.createCard({ cardholderName: "Test User" });
      cardId = createResult.card.id;

      await caller.linkPaymentMethod({
        cardId,
        paymentMethodId: "pm_test_123",
        amount: 1000,
      });

      // Process some transactions
      await caller.processTransaction({
        cardId,
        amount: 25.0,
        merchant: "Starbucks",
        description: "Coffee",
      });

      await caller.processTransaction({
        cardId,
        amount: 50.0,
        merchant: "Amazon",
        description: "Books",
      });
    });

    it("should retrieve transaction history", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.getTransactions({ cardId });

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
      expect(result.transactions[0].merchant).toBe("Amazon"); // Most recent first
      expect(result.transactions[1].merchant).toBe("Starbucks");
    });
  });

  describe("emulateCardScan", () => {
    beforeEach(async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.createCard({ cardholderName: "Test User" });
      cardId = result.card.id;
    });

    it("should emulate card scan with correct PIN", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);
      const result = await caller.emulateCardScan({
        cardId,
        pin: "1234",
      });

      expect(result.success).toBe(true);
      expect(result.appletData.aid).toBe("A0000000045645415243 48");
      expect(result.appletData.pan).toMatch(/^\d{16}$/);
      expect(result.appletData.expiry).toBe("07/30979");
      expect(result.appletData.status).toBe("active");
    });

    it("should reject scan with incorrect PIN", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);

      try {
        await caller.emulateCardScan({
          cardId,
          pin: "0000",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("getMyCards", () => {
    it("should retrieve all user's cards", async () => {
      const caller = paymentEmulatorRouter.createCaller(mockCtx);

      // Create multiple cards
      await caller.createCard({ cardholderName: "Card 1" });
      await caller.createCard({ cardholderName: "Card 2" });

      const result = await caller.getMyCards();

      expect(result.success).toBe(true);
      expect(result.cards.length).toBeGreaterThanOrEqual(2);
    });
  });
});
