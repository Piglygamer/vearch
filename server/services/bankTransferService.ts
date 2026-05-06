/**
 * @deprecated Legacy simulator.
 *
 * Bank Transfer Service - ACH & Wire Integration.
 *
 * ACH and wire transfers necessarily involve Vearch holding customer funds,
 * which is outside the no-custody middleman model (see LEGAL.md). The real
 * payment path is `server/services/charge.ts`. This module is kept
 * compiling to avoid breaking the legacy demo pages and will be removed in
 * a follow-up PR.
 */

import * as crypto from "crypto";

interface BankAccount {
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  accountType: "checking" | "savings";
  accountHolder: string;
}

interface ACHTransfer {
  transferId: string;
  amount: number;
  sourceAccount: BankAccount;
  destinationAccount: BankAccount;
  type: "debit" | "credit";
  status: "pending" | "submitted" | "settled" | "failed" | "returned";
  createdAt: Date;
  settledAt?: Date;
  nacha?: {
    batchNumber: string;
    entryDetailRecord: string;
    traceNumber: string;
  };
  errorCode?: string;
  errorMessage?: string;
}

interface WireTransfer {
  transferId: string;
  amount: number;
  sourceAccount: BankAccount;
  destinationAccount: BankAccount;
  beneficiaryBank: {
    name: string;
    swiftCode: string;
    routingNumber: string;
  };
  status: "pending" | "sent" | "delivered" | "failed" | "returned";
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  wireReference?: string;
  errorCode?: string;
  errorMessage?: string;
}

// In-memory transfer tracking
const achTransfers: Map<string, ACHTransfer> = new Map();
const wireTransfers: Map<string, WireTransfer> = new Map();

/**
 * Initiate ACH Transfer (2-3 business days)
 * Used for deposits and withdrawals
 */
export async function initiateACHTransfer(
  sourceAccount: BankAccount,
  destinationAccount: BankAccount,
  amount: number,
  type: "debit" | "credit"
): Promise<ACHTransfer> {
  const transferId = `ACH_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const transfer: ACHTransfer = {
    transferId,
    amount,
    sourceAccount,
    destinationAccount,
    type,
    status: "pending",
    createdAt: new Date(),
    nacha: {
      batchNumber: generateNACHABatchNumber(),
      entryDetailRecord: generateNACHAEntryDetailRecord(
        sourceAccount,
        destinationAccount,
        amount,
        type
      ),
      traceNumber: generateTraceNumber(),
    },
  };

  achTransfers.set(transferId, transfer);

  console.log(`[BankTransfer] ACH ${type} initiated: ${transferId}`);
  console.log(`[BankTransfer] Amount: $${amount}`);
  console.log(`[BankTransfer] From: ${sourceAccount.bankName} (${sourceAccount.routingNumber})`);
  console.log(`[BankTransfer] To: ${destinationAccount.bankName} (${destinationAccount.routingNumber})`);
  console.log(`[BankTransfer] NACHA Batch: ${transfer.nacha?.batchNumber}`);
  console.log(`[BankTransfer] Trace Number: ${transfer.nacha?.traceNumber}`);

  // Simulate ACH processing
  simulateACHProcessing(transferId);

  return transfer;
}

/**
 * Initiate Wire Transfer (same day or next day)
 * Used for urgent transfers
 */
export async function initiateWireTransfer(
  sourceAccount: BankAccount,
  destinationAccount: BankAccount,
  amount: number,
  beneficiaryBank: {
    name: string;
    swiftCode: string;
    routingNumber: string;
  }
): Promise<WireTransfer> {
  const transferId = `WIRE_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const wireReference = `VEARCH${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const transfer: WireTransfer = {
    transferId,
    amount,
    sourceAccount,
    destinationAccount,
    beneficiaryBank,
    status: "pending",
    createdAt: new Date(),
    wireReference,
  };

  wireTransfers.set(transferId, transfer);

  console.log(`[BankTransfer] Wire transfer initiated: ${transferId}`);
  console.log(`[BankTransfer] Amount: $${amount}`);
  console.log(`[BankTransfer] From: ${sourceAccount.bankName} (${sourceAccount.routingNumber})`);
  console.log(`[BankTransfer] To: ${destinationAccount.bankName} (${beneficiaryBank.swiftCode})`);
  console.log(`[BankTransfer] Wire Reference: ${wireReference}`);

  // Simulate wire processing
  simulateWireProcessing(transferId);

  return transfer;
}

/**
 * Get ACH transfer status
 */
export function getACHTransferStatus(transferId: string): ACHTransfer | null {
  return achTransfers.get(transferId) || null;
}

/**
 * Get Wire transfer status
 */
export function getWireTransferStatus(transferId: string): WireTransfer | null {
  return wireTransfers.get(transferId) || null;
}

/**
 * Validate bank account
 */
export function validateBankAccount(account: BankAccount): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate routing number (9 digits)
  if (!/^\d{9}$/.test(account.routingNumber)) {
    errors.push("Invalid routing number (must be 9 digits)");
  }

  // Validate account number (8-17 digits)
  if (!/^\d{8,17}$/.test(account.accountNumber)) {
    errors.push("Invalid account number (must be 8-17 digits)");
  }

  // Validate account holder name
  if (!account.accountHolder || account.accountHolder.trim().length < 2) {
    errors.push("Invalid account holder name");
  }

  // Validate bank name
  if (!account.bankName || account.bankName.trim().length < 2) {
    errors.push("Invalid bank name");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify bank account ownership (mock verification)
 */
export async function verifyBankAccountOwnership(
  account: BankAccount,
  userId: number
): Promise<{
  verified: boolean;
  verificationId?: string;
  microDeposits?: {
    amount1: number;
    amount2: number;
    depositDate: Date;
  };
}> {
  const verificationId = `VERIFY_${userId}_${Date.now()}`;

  console.log(`[BankTransfer] Initiating account verification: ${verificationId}`);
  console.log(`[BankTransfer] Account: ${account.accountNumber.slice(-4).padStart(account.accountNumber.length, "*")}`);

  // Simulate micro-deposit verification
  const microDeposits = {
    amount1: Math.floor(Math.random() * 50) + 1, // $1-50
    amount2: Math.floor(Math.random() * 50) + 1, // $1-50
    depositDate: new Date(Date.now() + 1000 * 60 * 60 * 24), // Tomorrow
  };

  console.log(`[BankTransfer] Micro-deposits scheduled for ${microDeposits.depositDate.toLocaleDateString()}`);
  console.log(`[BankTransfer] Deposit amounts: $${microDeposits.amount1} and $${microDeposits.amount2}`);

  return {
    verified: false,
    verificationId,
    microDeposits,
  };
}

/**
 * Confirm micro-deposit verification
 */
export function confirmMicroDepositVerification(
  verificationId: string,
  amount1: number,
  amount2: number
): {
  verified: boolean;
  message: string;
} {
  // Mock verification - in production, this would check against actual deposits
  const isValid = Math.random() > 0.1; // 90% success rate

  if (isValid) {
    console.log(`[BankTransfer] Micro-deposit verification successful: ${verificationId}`);
    return {
      verified: true,
      message: "Bank account verified successfully",
    };
  } else {
    console.log(`[BankTransfer] Micro-deposit verification failed: ${verificationId}`);
    return {
      verified: false,
      message: "Micro-deposit amounts do not match. Please try again.",
    };
  }
}

/**
 * Simulate ACH processing stages
 */
function simulateACHProcessing(transferId: string): void {
  const transfer = achTransfers.get(transferId);
  if (!transfer) return;

  // Stage 1: Submitted (after 1 second)
  setTimeout(() => {
    transfer.status = "submitted";
    console.log(`[BankTransfer] ACH transfer submitted: ${transferId}`);
  }, 1000);

  // Stage 2: Settled (after 3-5 seconds, simulating 2-3 business days)
  setTimeout(() => {
    transfer.status = "settled";
    transfer.settledAt = new Date();
    console.log(`[BankTransfer] ACH transfer settled: ${transferId}`);
  }, 3000 + Math.random() * 2000);
}

/**
 * Simulate Wire processing stages
 */
function simulateWireProcessing(transferId: string): void {
  const transfer = wireTransfers.get(transferId);
  if (!transfer) return;

  // Stage 1: Sent (after 1 second)
  setTimeout(() => {
    transfer.status = "sent";
    transfer.sentAt = new Date();
    console.log(`[BankTransfer] Wire transfer sent: ${transferId}`);
  }, 1000);

  // Stage 2: Delivered (after 2-3 seconds, simulating same/next day)
  setTimeout(() => {
    transfer.status = "delivered";
    transfer.deliveredAt = new Date();
    console.log(`[BankTransfer] Wire transfer delivered: ${transferId}`);
  }, 2000 + Math.random() * 1000);
}

/**
 * Generate NACHA batch number (10 digits)
 */
function generateNACHABatchNumber(): string {
  return Math.floor(Math.random() * 10000000000).toString().padStart(10, "0");
}

/**
 * Generate NACHA entry detail record
 */
function generateNACHAEntryDetailRecord(
  source: BankAccount,
  destination: BankAccount,
  amount: number,
  type: "debit" | "credit"
): string {
  // Simplified NACHA format
  const transactionCode = type === "debit" ? "27" : "22"; // 27=PPD debit, 22=PPD credit
  const amount_str = Math.floor(amount * 100).toString().padStart(10, "0");
  const routing = destination.routingNumber;
  const account = destination.accountNumber.padStart(17, " ");

  return `6${transactionCode}${routing}${account}${amount_str}`;
}

/**
 * Generate trace number (15 digits)
 */
function generateTraceNumber(): string {
  return Math.floor(Math.random() * 1000000000000000).toString().padStart(15, "0");
}

export const bankTransferService = {
  initiateACHTransfer,
  initiateWireTransfer,
  getACHTransferStatus,
  getWireTransferStatus,
  validateBankAccount,
  verifyBankAccountOwnership,
  confirmMicroDepositVerification,
};
