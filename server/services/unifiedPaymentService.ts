/**
 * Unified Payment Service
 * Combines cryptocurrency and bank transfer processing into one interface
 * Handles deposits and withdrawals with real money
 */

import {
  processCryptoDeposit,
  processBankTransferDeposit,
  processCryptoWithdrawal,
  processBankTransferWithdrawal,
  checkTransactionStatus,
} from "./realPaymentEngine";

import {
  initiateACHTransfer,
  initiateWireTransfer,
  getACHTransferStatus,
  getWireTransferStatus,
  validateBankAccount,
  verifyBankAccountOwnership,
  confirmMicroDepositVerification,
} from "./bankTransferService";

export interface UnifiedDepositRequest {
  userId: number;
  amount: number;
  method: "crypto" | "ach" | "wire";
  cryptoCurrency?: "BTC" | "ETH" | "SOL" | "USDC" | "USDT";
  bankAccount?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    accountType: "checking" | "savings";
    accountHolder: string;
  };
}

export interface UnifiedWithdrawalRequest {
  userId: number;
  amount: number;
  method: "crypto" | "ach" | "wire";
  destinationAddress?: string;
  destinationBank?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    accountType: "checking" | "savings";
    accountHolder: string;
  };
  beneficiaryBank?: {
    name: string;
    swiftCode: string;
    routingNumber: string;
  };
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  method: "crypto" | "ach" | "wire";
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  estimatedCompletion?: string;
  details?: Record<string, unknown>;
}

/**
 * Process unified deposit
 */
export async function processDeposit(request: UnifiedDepositRequest): Promise<PaymentResult> {
  try {
    if (request.method === "crypto") {
      if (!request.cryptoCurrency) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "crypto",
          status: "failed",
          message: "Crypto currency must be specified",
        };
      }

      const transaction = await processCryptoDeposit({
        userId: request.userId,
        amount: request.amount,
        paymentMethod: "crypto",
        cryptoCurrency: request.cryptoCurrency,
      });

      return {
        success: true,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        method: "crypto",
        status: "pending",
        message: `Crypto deposit initiated. Send ${request.cryptoCurrency} to the provided address.`,
        estimatedCompletion: "10-30 minutes (depending on network)",
        details: {
          cryptoCurrency: request.cryptoCurrency,
          blockchainVerificationPending: true,
        },
      };
    } else if (request.method === "ach") {
      if (!request.bankAccount) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "ach",
          status: "failed",
          message: "Bank account information must be provided",
        };
      }

      // Validate bank account
      const validation = validateBankAccount(request.bankAccount);
      if (!validation.valid) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "ach",
          status: "failed",
          message: `Invalid bank account: ${validation.errors.join(", ")}`,
        };
      }

      const transaction = await processBankTransferDeposit({
        userId: request.userId,
        amount: request.amount,
        paymentMethod: "bank_transfer",
        bankAccount: request.bankAccount,
      });

      return {
        success: true,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        method: "ach",
        status: "pending",
        message: `ACH deposit initiated. Funds will be available in 2-3 business days.`,
        estimatedCompletion: "2-3 business days",
        details: {
          bankReference: transaction.bankReference,
          achVerificationPending: true,
        },
      };
    } else if (request.method === "wire") {
      if (!request.bankAccount) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "wire",
          status: "failed",
          message: "Bank account information must be provided",
        };
      }

      // Validate bank account
      const validation = validateBankAccount(request.bankAccount);
      if (!validation.valid) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "wire",
          status: "failed",
          message: `Invalid bank account: ${validation.errors.join(", ")}`,
        };
      }

      const transaction = await processBankTransferDeposit({
        userId: request.userId,
        amount: request.amount,
        paymentMethod: "bank_transfer",
        bankAccount: request.bankAccount,
      });

      return {
        success: true,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        method: "wire",
        status: "pending",
        message: `Wire transfer initiated. Funds will be available same day or next business day.`,
        estimatedCompletion: "Same day or next business day",
        details: {
          bankReference: transaction.bankReference,
          wireTransferInitiated: true,
        },
      };
    }

    return {
      success: false,
      transactionId: "",
      amount: request.amount,
      method: request.method,
      status: "failed",
      message: "Invalid payment method",
    };
  } catch (error) {
    console.error("[UnifiedPayment] Deposit failed:", error);
    return {
      success: false,
      transactionId: "",
      amount: request.amount,
      method: request.method,
      status: "failed",
      message: `Deposit failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Process unified withdrawal
 */
export async function processWithdrawal(request: UnifiedWithdrawalRequest): Promise<PaymentResult> {
  try {
    if (request.method === "crypto") {
      if (!request.destinationAddress) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "crypto",
          status: "failed",
          message: "Destination crypto address must be specified",
        };
      }

      const transaction = await processCryptoWithdrawal({
        userId: request.userId,
        amount: request.amount,
        paymentMethod: "crypto",
        destinationAddress: request.destinationAddress,
      });

      return {
        success: true,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        method: "crypto",
        status: "pending",
        message: `Crypto withdrawal initiated. Funds will be sent to your wallet.`,
        estimatedCompletion: "10-30 minutes (depending on network)",
        details: {
          destinationAddress: request.destinationAddress,
          blockchainTransmissionInProgress: true,
        },
      };
    } else if (request.method === "ach") {
      if (!request.destinationBank) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "ach",
          status: "failed",
          message: "Destination bank account must be specified",
        };
      }

      // Validate destination bank account
      const validation = validateBankAccount(request.destinationBank);
      if (!validation.valid) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "ach",
          status: "failed",
          message: `Invalid destination bank account: ${validation.errors.join(", ")}`,
        };
      }

      const transaction = await processBankTransferWithdrawal({
        userId: request.userId,
        amount: request.amount,
        paymentMethod: "bank_transfer",
        destinationBank: request.destinationBank,
      });

      return {
        success: true,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        method: "ach",
        status: "pending",
        message: `ACH withdrawal initiated. Funds will arrive in 2-3 business days.`,
        estimatedCompletion: "2-3 business days",
        details: {
          bankReference: transaction.bankReference,
          achTransmissionInProgress: true,
        },
      };
    } else if (request.method === "wire") {
      if (!request.destinationBank || !request.beneficiaryBank) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "wire",
          status: "failed",
          message: "Destination bank and beneficiary bank information must be specified",
        };
      }

      // Validate destination bank account
      const validation = validateBankAccount(request.destinationBank);
      if (!validation.valid) {
        return {
          success: false,
          transactionId: "",
          amount: request.amount,
          method: "wire",
          status: "failed",
          message: `Invalid destination bank account: ${validation.errors.join(", ")}`,
        };
      }

      const transaction = await processBankTransferWithdrawal({
        userId: request.userId,
        amount: request.amount,
        paymentMethod: "bank_transfer",
        destinationBank: request.destinationBank,
      });

      return {
        success: true,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        method: "wire",
        status: "pending",
        message: `Wire transfer initiated. Funds will arrive same day or next business day.`,
        estimatedCompletion: "Same day or next business day",
        details: {
          bankReference: transaction.bankReference,
          wireTransferInitiated: true,
        },
      };
    }

    return {
      success: false,
      transactionId: "",
      amount: request.amount,
      method: request.method,
      status: "failed",
      message: "Invalid payment method",
    };
  } catch (error) {
    console.error("[UnifiedPayment] Withdrawal failed:", error);
    return {
      success: false,
      transactionId: "",
      amount: request.amount,
      method: request.method,
      status: "failed",
      message: `Withdrawal failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(transactionId: string): Promise<{
  found: boolean;
  status?: string;
  message?: string;
}> {
  // Check crypto transaction
  const cryptoTransaction = await checkTransactionStatus(transactionId);
  if (cryptoTransaction) {
    return {
      found: true,
      status: cryptoTransaction.status,
      message: `Crypto transaction: ${cryptoTransaction.status}`,
    };
  }

  // Check ACH transfer
  const achTransfer = getACHTransferStatus(transactionId);
  if (achTransfer) {
    return {
      found: true,
      status: achTransfer.status,
      message: `ACH transfer: ${achTransfer.status}`,
    };
  }

  // Check Wire transfer
  const wireTransfer = getWireTransferStatus(transactionId);
  if (wireTransfer) {
    return {
      found: true,
      status: wireTransfer.status,
      message: `Wire transfer: ${wireTransfer.status}`,
    };
  }

  return {
    found: false,
    message: "Transaction not found",
  };
}

export const unifiedPaymentService = {
  processDeposit,
  processWithdrawal,
  checkPaymentStatus,
  validateBankAccount,
  verifyBankAccountOwnership,
  confirmMicroDepositVerification,
};
