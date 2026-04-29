/**
 * Cash Withdrawal Service
 * Generate QR codes for cash withdrawals at retail locations
 * Works without retailer partnerships - users show code at register
 */

import crypto from "crypto";

interface CashWithdrawalCode {
  code: string;
  qrCode: string;
  amount: number;
  expiresAt: Date;
  retailLocations: string[];
  instructions: string;
  claimCode: string;
}

interface WithdrawalTransaction {
  id: string;
  userId: number;
  amount: number;
  code: string;
  status: "active" | "claimed" | "expired" | "cancelled";
  createdAt: Date;
  expiresAt: Date;
  claimedAt?: Date;
  claimedLocation?: string;
}

// In-memory store for withdrawal codes (in production, use database)
const withdrawalCodes: Map<string, WithdrawalTransaction> = new Map();

/**
 * Generate a unique withdrawal code
 */
function generateWithdrawalCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

/**
 * Generate QR code data (can be rendered on frontend)
 */
function generateQRCodeData(code: string, amount: number): string {
  // QR code contains: code|amount|timestamp
  // This can be scanned at any retail location
  const data = `VEARCH_BANK|${code}|${amount}|${Date.now()}`;
  return Buffer.from(data).toString("base64");
}

/**
 * Create a cash withdrawal code
 */
export async function createCashWithdrawalCode(
  userId: number,
  amount: number,
  expirationMinutes: number = 60
): Promise<CashWithdrawalCode> {
  const code = generateWithdrawalCode();
  const claimCode = crypto.randomBytes(8).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  const transaction: WithdrawalTransaction = {
    id: `withdrawal_${userId}_${Date.now()}`,
    userId,
    amount,
    code,
    status: "active",
    createdAt: new Date(),
    expiresAt,
  };

  withdrawalCodes.set(code, transaction);

  console.log(
    `[Cash Withdrawal] Generated code ${code} for $${amount} (expires in ${expirationMinutes}min)`
  );

  return {
    code,
    qrCode: generateQRCodeData(code, amount),
    amount,
    expiresAt,
    retailLocations: [
      "Walgreens",
      "CVS",
      "7-Eleven",
      "Family Dollar",
      "Dollar General",
      "Walmart",
      "Target",
      "Best Buy",
    ],
    instructions: `
1. Show this code at any participating retailer
2. Tell cashier you want to withdraw $${amount}
3. Cashier scans the QR code or enters the code
4. Receive your cash instantly
5. Code expires in ${expirationMinutes} minutes
    `,
    claimCode,
  };
}

/**
 * Verify and claim a withdrawal code at a retail location
 */
export async function claimWithdrawalCode(
  code: string,
  location: string
): Promise<{ success: boolean; amount?: number; message: string }> {
  const transaction = withdrawalCodes.get(code);

  if (!transaction) {
    return { success: false, message: "Invalid or expired code" };
  }

  if (transaction.status !== "active") {
    return { success: false, message: "Code already claimed or cancelled" };
  }

  if (new Date() > transaction.expiresAt) {
    transaction.status = "expired";
    return { success: false, message: "Code has expired" };
  }

  // Mark as claimed
  transaction.status = "claimed";
  transaction.claimedAt = new Date();
  transaction.claimedLocation = location;

  console.log(
    `[Cash Withdrawal] Code ${code} claimed at ${location} for $${transaction.amount}`
  );

  return {
    success: true,
    amount: transaction.amount,
    message: `Successfully claimed $${transaction.amount} at ${location}`,
  };
}

/**
 * Get withdrawal status
 */
export async function getWithdrawalStatus(
  code: string
): Promise<WithdrawalTransaction | null> {
  const transaction = withdrawalCodes.get(code);

  if (!transaction) {
    return null;
  }

  // Check if expired
  if (new Date() > transaction.expiresAt && transaction.status === "active") {
    transaction.status = "expired";
  }

  return transaction;
}

/**
 * Cancel a withdrawal code
 */
export async function cancelWithdrawalCode(code: string): Promise<boolean> {
  const transaction = withdrawalCodes.get(code);

  if (!transaction) {
    return false;
  }

  if (transaction.status === "claimed") {
    return false; // Can't cancel claimed codes
  }

  transaction.status = "cancelled";
  console.log(`[Cash Withdrawal] Code ${code} cancelled`);

  return true;
}

/**
 * Get all active withdrawal codes for a user
 */
export async function getUserWithdrawalCodes(
  userId: number
): Promise<WithdrawalTransaction[]> {
  const userCodes: WithdrawalTransaction[] = [];

  for (const transaction of Array.from(withdrawalCodes.values())) {
    if (transaction.userId === userId) {
      // Check if expired
      if (new Date() > transaction.expiresAt && transaction.status === "active") {
        transaction.status = "expired";
      }
      userCodes.push(transaction);
    }
  }

  return userCodes;
}

/**
 * Clean up expired codes (run periodically)
 */
export async function cleanupExpiredCodes(): Promise<number> {
  let cleaned = 0;
  const now = new Date();

  for (const [code, transaction] of Array.from(withdrawalCodes.entries())) {
    if (
      now > transaction.expiresAt &&
      transaction.status !== "claimed" &&
      transaction.status !== "cancelled"
    ) {
      transaction.status = "expired";
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Cash Withdrawal] Cleaned up ${cleaned} expired codes`);
  }

  return cleaned;
}

/**
 * Get withdrawal statistics
 */
export async function getWithdrawalStats(): Promise<Record<string, any>> {
  let totalActive = 0;
  let totalClaimed = 0;
  let totalExpired = 0;
  let totalAmount = 0;
  let claimedAmount = 0;

  for (const transaction of Array.from(withdrawalCodes.values())) {
    totalAmount += transaction.amount;

    switch (transaction.status) {
      case "active":
        totalActive++;
        break;
      case "claimed":
        totalClaimed++;
        claimedAmount += transaction.amount;
        break;
      case "expired":
        totalExpired++;
        break;
    }
  }

  return {
    totalCodes: withdrawalCodes.size,
    activeCount: totalActive,
    claimedCount: totalClaimed,
    expiredCount: totalExpired,
    totalAmount: `$${totalAmount.toFixed(2)}`,
    claimedAmount: `$${claimedAmount.toFixed(2)}`,
    successRate: totalClaimed / (totalClaimed + totalExpired) || 0,
  };
}

export const cashWithdrawalService = {
  createCashWithdrawalCode,
  claimWithdrawalCode,
  getWithdrawalStatus,
  cancelWithdrawalCode,
  getUserWithdrawalCodes,
  cleanupExpiredCodes,
  getWithdrawalStats,
};
