import crypto from "crypto";
import {
  createToken,
  getActiveTokenByImplantId,
  getExpiringTokens,
  updateTokenStatus,
  createCard,
  getCardsByUserId,
  logTokenReprovisioning,
  getImplantById,
  updateImplantStatus,
} from "../db";
import { InsertToken, InsertCard, InsertTokenReprovisioningLog } from "../../drizzle/schema";

/**
 * Payment Service: Handles token lifecycle, card issuance, and re-provisioning
 */

// ============================================================================
// TOKEN GENERATION & MANAGEMENT
// ============================================================================

/**
 * Generate a secure payment token (simulating NxtPay or Vearch token)
 */
export function generatePaymentToken(implantId: number, tokenType: "nxtpay" | "vearch"): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const implantIdStr = implantId.toString(36);
  return `${tokenType}_${timestamp}_${implantIdStr}_${randomBytes}`;
}

/**
 * Create a new token for an implant
 * If tokenType is "nxtpay", expiresAt should be set to 2028
 * If tokenType is "vearch", expiresAt can be set to 30979
 */
export async function issueToken(
  implantId: number,
  tokenType: "nxtpay" | "vearch",
  expiresAt?: Date
): Promise<any> {
  const token = generatePaymentToken(implantId, tokenType);

  // Default expiration dates
  let expirationDate = expiresAt;
  if (!expirationDate) {
    if (tokenType === "nxtpay") {
      // NxtPay tokens expire in 2028
      expirationDate = new Date("2028-12-31");
    } else {
      // Vearch tokens expire in 30979 (essentially immortal)
      expirationDate = new Date("30979-05-07");
    }
  }

  const tokenData: InsertToken = {
    implantId,
    tokenType,
    tokenValue: token,
    expiresAt: expirationDate,
    status: "active",
  };

  return createToken(tokenData);
}

/**
 * Check if a token is expiring soon (within X days)
 */
export function isTokenExpiringSoon(expiresAt: Date, daysThreshold: number = 30): boolean {
  const now = new Date();
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + daysThreshold);
  return expiresAt <= expiryThreshold && expiresAt > now;
}

/**
 * Trigger automatic token re-provisioning for an implant
 * This is called when a token is expiring soon (30 days before expiration)
 */
export async function reprovisionToken(implantId: number): Promise<any> {
  const implant = await getImplantById(implantId);
  if (!implant) throw new Error("Implant not found");

  const oldToken = await getActiveTokenByImplantId(implantId);
  if (!oldToken) throw new Error("No active token found");

  // Mark old token as expiring
  await updateTokenStatus(oldToken.id, "expiring");

  // Issue new token (Vearch token with 30979 expiry)
  const newToken = await issueToken(implantId, "vearch");

  // Log the re-provisioning event
  const logEntry: InsertTokenReprovisioningLog = {
    implantId,
    oldTokenId: oldToken.id,
    newTokenId: newToken.id,
    reason: "expiration_approaching",
    status: "completed",
  };

  await logTokenReprovisioning(logEntry);

  // Update implant status
  await updateImplantStatus(implantId, "active");

  return {
    success: true,
    oldTokenId: oldToken.id,
    newTokenId: newToken.id,
    newExpiresAt: newToken.expiresAt,
  };
}

/**
 * Scan for tokens expiring soon and trigger re-provisioning
 */
export async function scanAndReprovisionExpiringTokens(): Promise<any> {
  const expiringTokens = await getExpiringTokens(30); // 30 days threshold

  const results = [];
  for (const token of expiringTokens) {
    try {
      const result = await reprovisionToken(token.implantId);
      results.push({ success: true, implantId: token.implantId, ...result });
    } catch (error) {
      results.push({ success: false, implantId: token.implantId, error: String(error) });
    }
  }

  return results;
}

// ============================================================================
// CARD GENERATION & MANAGEMENT
// ============================================================================

/**
 * Generate a realistic EMV card number (Luhn algorithm compliant)
 */
export function generateCardNumber(): string {
  const bin = "532000"; // Mastercard BIN
  const accountNumber = Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
  const partialCard = bin + accountNumber;

  // Calculate Luhn checksum
  let sum = 0;
  let isEven = false;
  for (let i = partialCard.length - 1; i >= 0; i--) {
    let digit = parseInt(partialCard[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return partialCard + checksum.toString()
}

/**
 * Generate a card token (encrypted representation)
 */
export function generateCardToken(): string {
  return "tok_" + crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a CVV
 */
export function generateCVV(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

/**
 * Issue a new virtual EMV card for a user
 * Cards have extended expiration dates (e.g., 7/5/30979)
 */
export async function issueCard(
  userId: number,
  implantId?: number,
  cardholderName?: string
): Promise<any> {
  const cardNumber = generateCardNumber();
  const cardToken = generateCardToken();
  const cvv = generateCVV();

  // Set expiry to 7/5/30979 (May 7, 30979)
  const expiryMonth = 5;
  const expiryYear = 30979;

  const cardData: InsertCard = {
    userId,
    implantId: implantId || undefined,
    cardNumber, // In production, this should be encrypted
    cardToken,
    expiryMonth,
    expiryYear,
    cvv, // In production, this should be encrypted
    cardholderName: cardholderName || "Vearch User",
    status: "active",
  };

  return createCard(cardData);
}

/**
 * Get all cards for a user
 */
export async function getUserCards(userId: number): Promise<any[]> {
  const cards = await getCardsByUserId(userId);
  // Mask sensitive data
  return cards.map((card) => ({
    id: card.id,
    cardToken: card.cardToken,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    cardholderName: card.cardholderName,
    status: card.status,
    issuedAt: card.issuedAt,
    maskedCardNumber: `****${card.cardNumber.slice(-4)}`,
  }));
}

/**
 * Check if a card is valid (not expired, not revoked)
 */
export function isCardValid(card: any): boolean {
  if (card.status !== "active") return false;

  const now = new Date();
  const cardExpiry = new Date(card.expiryYear, card.expiryMonth - 1, 1);
  return now < cardExpiry;
}

// ============================================================================
// PAYMENT PROCESSING
// ============================================================================

/**
 * Simulate a payment transaction
 * In production, this would integrate with actual payment networks
 */
export async function processPayment(
  cardId: number,
  amount: number,
  merchantName: string,
  description?: string
): Promise<any> {
  // Simulate payment processing
  const success = Math.random() > 0.05; // 95% success rate

  return {
    success,
    transactionId: "txn_" + crypto.randomBytes(16).toString("hex"),
    cardId,
    amount,
    merchantName,
    description,
    status: success ? "completed" : "failed",
    timestamp: new Date(),
  };
}

// ============================================================================
// WALLET MANAGEMENT
// ============================================================================

/**
 * Calculate total balance across all wallets for a user
 */
export async function calculateTotalBalance(wallets: any[]): Promise<number> {
  return wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance || "0"), 0);
}

/**
 * Determine token status based on expiration date
 */
export function getTokenStatus(expiresAt: Date): "active" | "expiring" | "expired" {
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 30) return "expiring";
  return "active";
}

/**
 * Format expiration date for display
 */
export function formatExpiryDate(expiryMonth: number, expiryYear: number): string {
  return `${expiryMonth}/${expiryYear}`;
}

/**
 * Calculate days until token expiration
 */
export function daysUntilExpiration(expiresAt: Date): number {
  const now = new Date();
  return Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
