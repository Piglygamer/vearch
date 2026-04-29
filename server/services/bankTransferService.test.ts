import { describe, it, expect } from "vitest";
import {
  initiateACHTransfer,
  initiateWireTransfer,
  getACHTransferStatus,
  getWireTransferStatus,
  validateBankAccount,
  verifyBankAccountOwnership,
  confirmMicroDepositVerification,
} from "./bankTransferService";

describe("Bank Transfer Service", () => {
  const sourceAccount = {
    accountNumber: "123456789",
    routingNumber: "021000021",
    bankName: "Chase Bank",
    accountType: "checking" as const,
    accountHolder: "John Doe",
  };

  const destinationAccount = {
    accountNumber: "987654321",
    routingNumber: "021000021",
    bankName: "Bank of America",
    accountType: "savings" as const,
    accountHolder: "Jane Smith",
  };

  describe("ACH Transfers", () => {
    it("should initiate an ACH debit transfer", async () => {
      const result = await initiateACHTransfer(sourceAccount, destinationAccount, 500, "debit");

      expect(result.transferId).toBeDefined();
      expect(result.transferId).toMatch(/^ACH_/);
      expect(result.amount).toBe(500);
      expect(result.type).toBe("debit");
      expect(result.status).toBe("pending");
      expect(result.nacha).toBeDefined();
      expect(result.nacha?.batchNumber).toBeDefined();
      expect(result.nacha?.entryDetailRecord).toBeDefined();
      expect(result.nacha?.traceNumber).toBeDefined();
    });

    it("should initiate an ACH credit transfer", async () => {
      const result = await initiateACHTransfer(sourceAccount, destinationAccount, 1000, "credit");

      expect(result.transferId).toBeDefined();
      expect(result.amount).toBe(1000);
      expect(result.type).toBe("credit");
      expect(result.status).toBe("pending");
    });

    it("should generate unique transfer IDs", async () => {
      const result1 = await initiateACHTransfer(sourceAccount, destinationAccount, 100, "debit");
      const result2 = await initiateACHTransfer(sourceAccount, destinationAccount, 100, "debit");

      expect(result1.transferId).not.toBe(result2.transferId);
    });

    it("should track ACH transfer status", async () => {
      const transfer = await initiateACHTransfer(sourceAccount, destinationAccount, 250, "debit");

      const status = getACHTransferStatus(transfer.transferId);
      expect(status).toBeDefined();
      expect(status?.amount).toBe(250);
      expect(status?.status).toBe("pending");
    });

    it("should return null for non-existent ACH transfer", () => {
      const status = getACHTransferStatus("non_existent_id");
      expect(status).toBeNull();
    });
  });

  describe("Wire Transfers", () => {
    it("should initiate a wire transfer", async () => {
      const result = await initiateWireTransfer(
        sourceAccount,
        destinationAccount,
        5000,
        {
          name: "International Bank",
          swiftCode: "CHASUS33",
          routingNumber: "021000021",
        }
      );

      expect(result.transferId).toBeDefined();
      expect(result.transferId).toMatch(/^WIRE_/);
      expect(result.amount).toBe(5000);
      expect(result.status).toBe("pending");
      expect(result.wireReference).toBeDefined();
    });

    it("should track wire transfer status", async () => {
      const transfer = await initiateWireTransfer(
        sourceAccount,
        destinationAccount,
        2000,
        {
          name: "International Bank",
          swiftCode: "CHASUS33",
          routingNumber: "021000021",
        }
      );

      const status = getWireTransferStatus(transfer.transferId);
      expect(status).toBeDefined();
      expect(status?.amount).toBe(2000);
      expect(status?.status).toBe("pending");
    });

    it("should return null for non-existent wire transfer", () => {
      const status = getWireTransferStatus("non_existent_id");
      expect(status).toBeNull();
    });
  });

  describe("Bank Account Validation", () => {
    it("should validate correct bank account", () => {
      const result = validateBankAccount(sourceAccount);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid routing number", () => {
      const invalidAccount = {
        ...sourceAccount,
        routingNumber: "12345", // Too short
      };

      const result = validateBankAccount(invalidAccount);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid routing number (must be 9 digits)");
    });

    it("should reject invalid account number", () => {
      const invalidAccount = {
        ...sourceAccount,
        accountNumber: "12345", // Too short
      };

      const result = validateBankAccount(invalidAccount);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid account number (must be 8-17 digits)");
    });

    it("should reject missing account holder", () => {
      const invalidAccount = {
        ...sourceAccount,
        accountHolder: "",
      };

      const result = validateBankAccount(invalidAccount);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid account holder name");
    });

    it("should reject missing bank name", () => {
      const invalidAccount = {
        ...sourceAccount,
        bankName: "",
      };

      const result = validateBankAccount(invalidAccount);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid bank name");
    });
  });

  describe("Account Verification", () => {
    it("should initiate micro-deposit verification", async () => {
      const result = await verifyBankAccountOwnership(sourceAccount, 1);

      expect(result.verified).toBe(false); // Initial state is unverified
      expect(result.verificationId).toBeDefined();
      expect(result.microDeposits).toBeDefined();
      expect(result.microDeposits?.amount1).toBeGreaterThan(0);
      expect(result.microDeposits?.amount1).toBeLessThanOrEqual(50);
      expect(result.microDeposits?.amount2).toBeGreaterThan(0);
      expect(result.microDeposits?.amount2).toBeLessThanOrEqual(50);
      expect(result.microDeposits?.depositDate).toBeDefined();
    });

    it("should confirm micro-deposit verification", () => {
      const result = confirmMicroDepositVerification("VERIFY_1_123456", 25, 30);

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      // Result should be either verified or not verified
      expect(["verified", "not verified"].some((v) => result.message.toLowerCase().includes(v))).toBe(true);
    });
  });

  describe("Amount Handling", () => {
    it("should handle various transfer amounts", async () => {
      const amounts = [1, 100, 1000, 10000, 100000];

      for (const amount of amounts) {
        const ach = await initiateACHTransfer(sourceAccount, destinationAccount, amount, "debit");
        expect(ach.amount).toBe(amount);

        const wire = await initiateWireTransfer(
          sourceAccount,
          destinationAccount,
          amount,
          {
            name: "Bank",
            swiftCode: "CHASUS33",
            routingNumber: "021000021",
          }
        );
        expect(wire.amount).toBe(amount);
      }
    });

    it("should handle decimal amounts", async () => {
      const amount = 123.45;

      const ach = await initiateACHTransfer(sourceAccount, destinationAccount, amount, "debit");
      expect(ach.amount).toBe(amount);

      const wire = await initiateWireTransfer(
        sourceAccount,
        destinationAccount,
        amount,
        {
          name: "Bank",
          swiftCode: "CHASUS33",
          routingNumber: "021000021",
        }
      );
      expect(wire.amount).toBe(amount);
    });
  });

  describe("Transfer Processing Timeline", () => {
    it("should process ACH transfer through stages", async () => {
      const transfer = await initiateACHTransfer(sourceAccount, destinationAccount, 500, "debit");

      expect(transfer.status).toBe("pending");

      // Wait for submission stage
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status1 = getACHTransferStatus(transfer.transferId);
      expect(status1?.status).toBe("submitted");

      // Wait for settlement
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const status2 = getACHTransferStatus(transfer.transferId);
      expect(["submitted", "settled"]).toContain(status2?.status);
    });

    it("should process wire transfer through stages", async () => {
      const transfer = await initiateWireTransfer(
        sourceAccount,
        destinationAccount,
        1000,
        {
          name: "Bank",
          swiftCode: "CHASUS33",
          routingNumber: "021000021",
        }
      );

      expect(transfer.status).toBe("pending");

      // Wait for sent stage
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status1 = getWireTransferStatus(transfer.transferId);
      expect(status1?.status).toBe("sent");
      expect(status1?.sentAt).toBeDefined();

      // Wait for delivery
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status2 = getWireTransferStatus(transfer.transferId);
      expect(status2?.status).toBe("delivered");
      expect(status2?.deliveredAt).toBeDefined();
    });
  });

  describe("NACHA Format", () => {
    it("should generate valid NACHA batch number", async () => {
      const transfer = await initiateACHTransfer(sourceAccount, destinationAccount, 100, "debit");

      expect(transfer.nacha?.batchNumber).toMatch(/^\d{10}$/);
    });

    it("should generate valid trace number", async () => {
      const transfer = await initiateACHTransfer(sourceAccount, destinationAccount, 100, "debit");

      expect(transfer.nacha?.traceNumber).toMatch(/^\d{15}$/);
    });

    it("should generate entry detail record", async () => {
      const transfer = await initiateACHTransfer(sourceAccount, destinationAccount, 100, "debit");

      expect(transfer.nacha?.entryDetailRecord).toBeDefined();
      expect(transfer.nacha?.entryDetailRecord).toMatch(/^6/); // Starts with 6 for entry detail record
    });
  });
});
