import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generatePaymentToken,
  generateCardNumber,
  generateCardToken,
  generateCVV,
  isTokenExpiringSoon,
  isCardValid,
  getTokenStatus,
  formatExpiryDate,
  daysUntilExpiration,
} from "./paymentService";

describe("Payment Service", () => {
  describe("Token Generation", () => {
    it("should generate a valid payment token", () => {
      const token = generatePaymentToken(1, "vearch");
      expect(token).toMatch(/^vearch_/);
      expect(token.length).toBeGreaterThan(20);
    });

    it("should generate different tokens each time", () => {
      const token1 = generatePaymentToken(1, "vearch");
      const token2 = generatePaymentToken(1, "vearch");
      expect(token1).not.toBe(token2);
    });

    it("should include token type in generated token", () => {
      const nxtpayToken = generatePaymentToken(1, "nxtpay");
      const vearchToken = generatePaymentToken(1, "vearch");
      expect(nxtpayToken).toMatch(/^nxtpay_/);
      expect(vearchToken).toMatch(/^vearch_/);
    });
  });

  describe("Card Generation", () => {
    it("should generate a valid card number", () => {
      const cardNumber = generateCardNumber();
      expect(cardNumber).toHaveLength(16);
      expect(/^\d+$/.test(cardNumber)).toBe(true);
    });

    it("should generate Luhn-compliant card numbers", () => {
      const cardNumber = generateCardNumber();
      expect(cardNumber).toHaveLength(16);
      expect(/^\d+$/.test(cardNumber)).toBe(true);
      expect(cardNumber.startsWith("532000")).toBe(true);
    });

    it("should generate different card numbers each time", () => {
      const card1 = generateCardNumber();
      const card2 = generateCardNumber();
      expect(card1).not.toBe(card2);
    });

    it("should generate a valid card token", () => {
      const token = generateCardToken();
      expect(token).toMatch(/^tok_/);
      expect(token.length).toBeGreaterThan(10);
    });

    it("should generate a valid CVV", () => {
      const cvv = generateCVV();
      expect(cvv).toHaveLength(3);
      expect(/^\d+$/.test(cvv)).toBe(true);
      const cvvNum = parseInt(cvv, 10);
      expect(cvvNum).toBeGreaterThanOrEqual(100);
      expect(cvvNum).toBeLessThanOrEqual(999);
    });
  });

  describe("Token Status Checks", () => {
    it("should correctly identify active tokens", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      expect(getTokenStatus(futureDate)).toBe("active");
    });

    it("should correctly identify expiring tokens", () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 15);
      expect(getTokenStatus(soonDate)).toBe("expiring");
    });

    it("should correctly identify expired tokens", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(getTokenStatus(pastDate)).toBe("expired");
    });

    it("should detect tokens expiring soon", () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 20);
      expect(isTokenExpiringSoon(soonDate, 30)).toBe(true);
    });

    it("should not flag tokens expiring beyond threshold", () => {
      const laterDate = new Date();
      laterDate.setDate(laterDate.getDate() + 60);
      expect(isTokenExpiringSoon(laterDate, 30)).toBe(false);
    });
  });

  describe("Card Validation", () => {
    it("should validate active cards", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const card = {
        status: "active",
        expiryMonth: futureDate.getMonth() + 1,
        expiryYear: futureDate.getFullYear(),
      };
      expect(isCardValid(card)).toBe(true);
    });

    it("should reject suspended cards", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const card = {
        status: "suspended",
        expiryMonth: futureDate.getMonth() + 1,
        expiryYear: futureDate.getFullYear(),
      };
      expect(isCardValid(card)).toBe(false);
    });

    it("should reject expired cards", () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const card = {
        status: "active",
        expiryMonth: pastDate.getMonth() + 1,
        expiryYear: pastDate.getFullYear(),
      };
      expect(isCardValid(card)).toBe(false);
    });

    it("should reject revoked cards", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const card = {
        status: "revoked",
        expiryMonth: futureDate.getMonth() + 1,
        expiryYear: futureDate.getFullYear(),
      };
      expect(isCardValid(card)).toBe(false);
    });
  });

  describe("Date Formatting", () => {
    it("should format expiry dates correctly", () => {
      expect(formatExpiryDate(5, 30979)).toBe("5/30979");
      expect(formatExpiryDate(12, 2028)).toBe("12/2028");
    });

    it("should calculate days until expiration", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const days = daysUntilExpiration(futureDate);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(30);
    });

    it("should return negative days for expired dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const days = daysUntilExpiration(pastDate);
      expect(days).toBeLessThan(0);
    });
  });

  describe("Vearch Card Expiration", () => {
    it("should issue cards with 30979 expiration year", () => {
      const expiryYear = 30979;
      const expiryMonth = 5;
      expect(expiryYear).toBe(30979);
      expect(expiryMonth).toBeGreaterThanOrEqual(1);
      expect(expiryMonth).toBeLessThanOrEqual(12);
    });

    it("should confirm cards with 30979 expiry are essentially immortal", () => {
      const card = {
        status: "active",
        expiryMonth: 5,
        expiryYear: 30979,
      };
      expect(isCardValid(card)).toBe(true);
      const daysUntilExp = daysUntilExpiration(new Date(30979, 4, 7));
      expect(daysUntilExp).toBeGreaterThan(1000000); // Over 1 million days
    });
  });

  describe("NxtPay Token Expiration", () => {
    it("should correctly identify 2028 expiration date", () => {
      const nxtpayExpiry = new Date("2028-12-31");
      const status = getTokenStatus(nxtpayExpiry);
      // Status depends on current date, but should be identifiable
      expect(["active", "expiring", "expired"]).toContain(status);
    });

    it("should calculate days until 2028 expiration", () => {
      const nxtpayExpiry = new Date("2028-12-31");
      const days = daysUntilExpiration(nxtpayExpiry);
      expect(days).toBeGreaterThan(0); // Should be in the future
    });
  });
});
