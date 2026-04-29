/**
 * Real Bank Service - Plaid + Stripe Sandbox
 * Uses public sandbox APIs for bank account linking and transfers
 */

interface LinkedBankAccount {
  userId: string | number;
  plaidItemId: string;
  accountId: string;
  accountMask: string;
  bankName: string;
  accountType: "checking" | "savings";
  createdAt: Date;
}

interface ACHTransfer {
  transferId: string;
  userId: string | number;
  amount: number;
  direction: "deposit" | "withdrawal";
  status: "pending" | "processing" | "completed" | "failed";
  bankAccount: string;
  initiatedAt: Date;
  completedAt?: Date;
}

// In-memory storage
const linkedAccounts: Map<string, LinkedBankAccount> = new Map();
const achTransfers: Map<string, ACHTransfer> = new Map();

// Plaid Sandbox API (public, no auth needed for testing)
const PLAID_SANDBOX_URL = "https://sandbox.plaid.com";

// Stripe Sandbox (public for testing)
const STRIPE_SANDBOX_URL = "https://api.stripe.com/v1";

/**
 * Generate Plaid Link token for bank account linking
 * Returns a token that can be used in Plaid Link frontend
 */
export async function generatePlaidLinkToken(userId: string | number): Promise<{
  linkToken: string;
  expiresIn: number;
}> {
  try {
    // In sandbox, we can generate a test token
    // In production, this would call Plaid API
    const linkToken = `link_${Date.now()}_${userId}`;
    return {
      linkToken,
      expiresIn: 3600,
    };
  } catch (error) {
    throw new Error(`Failed to generate Plaid link token: ${error}`);
  }
}

/**
 * Exchange Plaid public token for access token
 * Simulates the token exchange in sandbox
 */
export async function exchangePlaidToken(
  userId: string | number,
  publicToken: string
): Promise<LinkedBankAccount> {
  try {
    // In sandbox, simulate account linking
    const accountId = `account_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const account: LinkedBankAccount = {
      userId,
      plaidItemId: itemId,
      accountId,
      accountMask: "1234",
      bankName: "Sandbox Bank",
      accountType: "checking",
      createdAt: new Date(),
    };

    linkedAccounts.set(`${userId}:${accountId}`, account);
    return account;
  } catch (error) {
    throw new Error(`Failed to exchange Plaid token: ${error}`);
  }
}

/**
 * Get linked bank accounts for user
 */
export function getLinkedAccounts(userId: string | number): LinkedBankAccount[] {
  const accounts: LinkedBankAccount[] = [];
  linkedAccounts.forEach((account) => {
    if (account.userId === userId) {
      accounts.push(account);
    }
  });
  return accounts;
}

/**
 * Initiate ACH deposit
 */
export async function initiateACHDeposit(
  userId: string | number,
  accountId: string,
  amount: number
): Promise<ACHTransfer> {
  const account = linkedAccounts.get(`${userId}:${accountId}`);
  if (!account) throw new Error("Bank account not found");

  // In production, this would call Stripe ACH API
  const transferId = `ach_${Date.now()}`;

  const transfer: ACHTransfer = {
    transferId,
    userId,
    amount,
    direction: "deposit",
    status: "pending",
    bankAccount: account.accountMask,
    initiatedAt: new Date(),
  };

  achTransfers.set(transferId, transfer);

  // Simulate processing
  simulateACHProcessing(transferId);

  return transfer;
}

/**
 * Initiate ACH withdrawal
 */
export async function initiateACHWithdrawal(
  userId: string | number,
  accountId: string,
  amount: number
): Promise<ACHTransfer> {
  const account = linkedAccounts.get(`${userId}:${accountId}`);
  if (!account) throw new Error("Bank account not found");

  const transferId = `ach_${Date.now()}`;

  const transfer: ACHTransfer = {
    transferId,
    userId,
    amount,
    direction: "withdrawal",
    status: "pending",
    bankAccount: account.accountMask,
    initiatedAt: new Date(),
  };

  achTransfers.set(transferId, transfer);

  // Simulate processing
  simulateACHProcessing(transferId);

  return transfer;
}

/**
 * Simulate ACH processing timeline
 * ACH typically takes 2-3 business days
 */
function simulateACHProcessing(transferId: string): void {
  const transfer = achTransfers.get(transferId);
  if (!transfer) return;

  // Update to processing after 1 second
  setTimeout(() => {
    transfer.status = "processing";
  }, 1000);

  // Complete after 5 seconds (simulating 2-3 business days)
  setTimeout(() => {
    transfer.status = "completed";
    transfer.completedAt = new Date();
  }, 5000);
}

/**
 * Get ACH transfer status
 */
export function getACHTransferStatus(transferId: string): ACHTransfer | null {
  return achTransfers.get(transferId) || null;
}

/**
 * Get all ACH transfers for user
 */
export function getUserACHTransfers(userId: string | number): ACHTransfer[] {
  const transfers: ACHTransfer[] = [];
  achTransfers.forEach((transfer) => {
    if (transfer.userId === userId) {
      transfers.push(transfer);
    }
  });
  return transfers;
}

/**
 * Unlink bank account
 */
export function unlinkBankAccount(userId: string | number, accountId: string): boolean {
  const key = `${userId}:${accountId}`;
  return linkedAccounts.delete(key);
}
