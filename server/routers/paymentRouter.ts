import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  generateBitcoinAddress,
  generateEthereumAddress,
  getWallet,
  refreshBalance,
  getTransactionStatus,
  getWalletTransactions,
  getBalance,
} from "../services/realCryptoService";
import {
  generatePlaidLinkToken,
  exchangePlaidToken,
  getLinkedAccounts,
  initiateACHDeposit,
  initiateACHWithdrawal,
  getACHTransferStatus,
  getUserACHTransfers,
  unlinkBankAccount,
} from "../services/realBankService";

export const paymentRouter = router({
  // ============================================================================
  // CRYPTO - Real Testnet
  // ============================================================================

  crypto: router({
    generateBitcoinAddress: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const wallet = await generateBitcoinAddress(ctx.user.id);
        return {
          success: true,
          address: wallet.address,
          network: "bitcoin",
          balance: wallet.balance,
          message: "Bitcoin testnet address generated. Send testnet BTC to this address.",
        };
      } catch (error) {
        throw new Error(`Failed to generate Bitcoin address: ${error}`);
      }
    }),

    generateEthereumAddress: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const wallet = await generateEthereumAddress(ctx.user.id);
        return {
          success: true,
          address: wallet.address,
          network: "ethereum",
          balance: wallet.balance.toString(),
          message: "Ethereum Sepolia address generated. Send testnet ETH to this address.",
        };
      } catch (error) {
        throw new Error(`Failed to generate Ethereum address: ${error}`);
      }
    }),

    getAddress: protectedProcedure
      .input(z.object({ network: z.enum(["bitcoin", "ethereum"]) }))
      .query(({ ctx, input }) => {
        const wallet = getWallet(ctx.user.id, input.network);
        if (!wallet) return null;
        return {
          address: wallet.address,
          network: wallet.network,
          balance: wallet.balance.toString(),
          createdAt: wallet.createdAt,
        };
      }),

    getBalance: protectedProcedure
      .input(z.object({ network: z.enum(["bitcoin", "ethereum"]) }))
      .query(async ({ ctx, input }) => {
        try {
          const balance = await getBalance(ctx.user.id, input.network);
          return {
            network: input.network,
            balance: balance.toString(),
            currency: input.network === "bitcoin" ? "BTC" : "ETH",
          };
        } catch (error) {
          return { network: input.network, balance: "0", currency: input.network === "bitcoin" ? "BTC" : "ETH" };
        }
      }),

    getTransactions: protectedProcedure
      .input(z.object({ network: z.enum(["bitcoin", "ethereum"]) }))
      .query(async ({ ctx, input }) => {
        try {
          const txs = await getWalletTransactions(ctx.user.id, input.network);
          return txs.map((tx) => ({
            txHash: tx.txHash,
            amount: tx.amount.toString(),
            status: tx.status,
            confirmations: tx.confirmations,
            timestamp: tx.timestamp,
          }));
        } catch (error) {
          return [];
        }
      }),

    checkTransactionStatus: protectedProcedure
      .input(z.object({ txHash: z.string(), network: z.enum(["bitcoin", "ethereum"]) }))
      .query(async ({ input }) => {
        try {
          const tx = await getTransactionStatus(input.txHash, input.network);
          if (!tx) return null;
          return {
            txHash: tx.txHash,
            amount: tx.amount.toString(),
            status: tx.status,
            confirmations: tx.confirmations,
            timestamp: tx.timestamp,
          };
        } catch (error) {
          return null;
        }
      }),
  }),

  // ============================================================================
  // BANKING - Real Plaid + Stripe Sandbox
  // ============================================================================

  banking: router({
    generatePlaidLink: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await generatePlaidLinkToken(ctx.user.id);
        return {
          success: true,
          linkToken: result.linkToken,
          expiresIn: result.expiresIn,
          message: "Plaid Link token generated. Use this to link your bank account.",
        };
      } catch (error) {
        throw new Error(`Failed to generate Plaid link: ${error}`);
      }
    }),

    exchangePlaidToken: protectedProcedure
      .input(z.object({ publicToken: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const account = await exchangePlaidToken(ctx.user.id, input.publicToken);
          return {
            success: true,
            accountId: account.accountId,
            bankName: account.bankName,
            accountMask: account.accountMask,
            accountType: account.accountType,
            message: `Bank account linked: ${account.bankName} ****${account.accountMask}`,
          };
        } catch (error) {
          throw new Error(`Failed to link bank account: ${error}`);
        }
      }),

    getLinkedAccounts: protectedProcedure.query(({ ctx }) => {
      const accounts = getLinkedAccounts(ctx.user.id);
      return accounts.map((acc) => ({
        accountId: acc.accountId,
        bankName: acc.bankName,
        accountMask: acc.accountMask,
        accountType: acc.accountType,
        createdAt: acc.createdAt,
      }));
    }),

    initiateACHDeposit: protectedProcedure
      .input(z.object({ accountId: z.string(), amount: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const transfer = await initiateACHDeposit(ctx.user.id, input.accountId, parseFloat(input.amount));
          return {
            success: true,
            transferId: transfer.transferId,
            amount: transfer.amount.toString(),
            status: transfer.status,
            message: `ACH deposit initiated: $${transfer.amount} (2-3 business days)`,
          };
        } catch (error) {
          throw new Error(`Failed to initiate ACH deposit: ${error}`);
        }
      }),

    initiateACHWithdrawal: protectedProcedure
      .input(z.object({ accountId: z.string(), amount: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const transfer = await initiateACHWithdrawal(ctx.user.id, input.accountId, parseFloat(input.amount));
          return {
            success: true,
            transferId: transfer.transferId,
            amount: transfer.amount.toString(),
            status: transfer.status,
            message: `ACH withdrawal initiated: $${transfer.amount} (2-3 business days)`,
          };
        } catch (error) {
          throw new Error(`Failed to initiate ACH withdrawal: ${error}`);
        }
      }),

    getACHTransferStatus: protectedProcedure
      .input(z.object({ transferId: z.string() }))
      .query(({ input }) => {
        const transfer = getACHTransferStatus(input.transferId);
        if (!transfer) return null;
        return {
          transferId: transfer.transferId,
          amount: transfer.amount.toString(),
          direction: transfer.direction,
          status: transfer.status,
          bankAccount: transfer.bankAccount,
          initiatedAt: transfer.initiatedAt,
          completedAt: transfer.completedAt,
        };
      }),

    getUserACHTransfers: protectedProcedure.query(({ ctx }) => {
      const transfers = getUserACHTransfers(ctx.user.id);
      return transfers.map((t) => ({
        transferId: t.transferId,
        amount: t.amount.toString(),
        direction: t.direction,
        status: t.status,
        bankAccount: t.bankAccount,
        initiatedAt: t.initiatedAt,
        completedAt: t.completedAt,
      }));
    }),

    unlinkBankAccount: protectedProcedure
      .input(z.object({ accountId: z.string() }))
      .mutation(({ ctx, input }) => {
        const success = unlinkBankAccount(ctx.user.id, input.accountId);
        return {
          success,
          message: success ? "Bank account unlinked" : "Failed to unlink bank account",
        };
      }),
  }),
});
