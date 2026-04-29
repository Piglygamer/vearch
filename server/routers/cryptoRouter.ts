import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  generateBitcoinAddress,
  generateEthereumAddress,
  getAddress,
  simulateDeposit,
  simulateWithdrawal,
  getTransactionStatus,
  getUserTransactions,
  getCryptoBalance,
} from "../services/cryptoService";

export const cryptoRouter = router({
  /**
   * Generate a new Bitcoin testnet address for the user
   */
  generateBitcoinAddress: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const address = await generateBitcoinAddress(ctx.user.id);
      return {
        success: true,
        address: address.address,
        network: "bitcoin" as const,
        message: "Bitcoin testnet address generated successfully",
      };
    } catch (error) {
      throw new Error(`Failed to generate Bitcoin address: ${error}`);
    }
  }),

  /**
   * Generate a new Ethereum testnet (Sepolia) address for the user
   */
  generateEthereumAddress: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const address = await generateEthereumAddress(ctx.user.id);
      return {
        success: true,
        address: address.address,
        network: "ethereum" as const,
        message: "Ethereum testnet address generated successfully",
      };
    } catch (error) {
      throw new Error(`Failed to generate Ethereum address: ${error}`);
    }
  }),

  /**
   * Get existing crypto address for user
   */
  getAddress: protectedProcedure
    .input(z.object({ network: z.enum(["bitcoin", "ethereum"]) }))
    .query(({ ctx, input }) => {
      const address = getAddress(ctx.user.id, input.network);
      return address || null;
    }),

  /**
   * Simulate a crypto deposit (testnet faucet)
   */
  depositCrypto: protectedProcedure
    .input(
      z.object({
        network: z.enum(["bitcoin", "ethereum"]),
        amount: z.string().regex(/^\d+(\.\d{1,8})?$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const tx = await simulateDeposit(ctx.user.id, input.network, parseFloat(input.amount));
        return {
          success: true,
          transactionId: tx.txHash,
          amount: tx.amount.toString(),
          network: tx.network,
          toAddress: tx.toAddress,
          status: tx.status,
          confirmations: tx.confirmations,
          message: `${input.amount} ${input.network === "bitcoin" ? "BTC" : "ETH"} deposit initiated`,
        };
      } catch (error) {
        throw new Error(`Failed to deposit crypto: ${error}`);
      }
    }),

  /**
   * Simulate a crypto withdrawal (testnet)
   */
  withdrawCrypto: protectedProcedure
    .input(
      z.object({
        network: z.enum(["bitcoin", "ethereum"]),
        toAddress: z.string().min(20),
        amount: z.string().regex(/^\d+(\.\d{1,8})?$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const tx = await simulateWithdrawal(
          ctx.user.id,
          input.network,
          input.toAddress,
          parseFloat(input.amount)
        );
        return {
          success: true,
          transactionId: tx.txHash,
          amount: tx.amount.toString(),
          network: tx.network,
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          status: tx.status,
          confirmations: tx.confirmations,
          message: `${input.amount} ${input.network === "bitcoin" ? "BTC" : "ETH"} withdrawal initiated`,
        };
      } catch (error) {
        throw new Error(`Failed to withdraw crypto: ${error}`);
      }
    }),

  /**
   * Check transaction status
   */
  checkTransactionStatus: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(({ input }) => {
      const tx = getTransactionStatus(input.transactionId);
      if (!tx) return null;
      return {
        transactionId: tx.txHash,
        network: tx.network,
        amount: tx.amount,
        status: tx.status,
        confirmations: tx.confirmations,
        fromAddress: tx.fromAddress,
        toAddress: tx.toAddress,
        createdAt: tx.createdAt,
      };
    }),

  /**
   * Get all crypto transactions for user
   */
  getTransactions: protectedProcedure.query(({ ctx }) => {
    const txs = getUserTransactions(ctx.user.id);
    return txs.map((tx) => ({
      transactionId: tx.txHash,
      network: tx.network,
      amount: tx.amount,
      status: tx.status,
      confirmations: tx.confirmations,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      createdAt: tx.createdAt,
    }));
  }),

  /**
   * Get crypto balance for user
   */
  getBalance: protectedProcedure
    .input(z.object({ network: z.enum(["bitcoin", "ethereum"]) }))
    .query(({ ctx, input }) => {
      const balance = getCryptoBalance(ctx.user.id, input.network);
      return {
        network: input.network,
        balance,
        currency: input.network === "bitcoin" ? "BTC" : "ETH",
      };
    }),
});
