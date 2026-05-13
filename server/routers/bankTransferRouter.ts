import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  linkBankAccount,
  initiateACHTransfer,
  initiateWireTransfer,
  getTransferStatus,
} from '../services/bankTransfer';

export const bankTransferRouter = router({
  /**
   * Link bank account via Plaid
   */
  linkAccount: protectedProcedure
    .input(
      z.object({
        plaidPublicToken: z.string(),
        accountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await linkBankAccount({
        userId: ctx.user.id,
        plaidPublicToken: input.plaidPublicToken,
        accountId: input.accountId,
      });
      return result;
    }),

  /**
   * Initiate ACH transfer (debit or credit)
   */
  initiateACH: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        direction: z.enum(['debit', 'credit']),
        bankAccount: z.object({
          accountId: z.string(),
          bankName: z.string(),
          accountType: z.enum(['checking', 'savings']),
          accountNumber: z.string(),
          routingNumber: z.string(),
          accountHolder: z.string(),
          verified: z.boolean(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await initiateACHTransfer({
        userId: ctx.user.id,
        amount: input.amount,
        direction: input.direction,
        bankAccount: input.bankAccount,
      });
      return result;
    }),

  /**
   * Initiate wire transfer
   */
  initiateWire: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        beneficiaryBank: z.object({
          name: z.string(),
          swiftCode: z.string(),
          address: z.string(),
        }),
        bankAccount: z.object({
          accountId: z.string(),
          bankName: z.string(),
          accountType: z.enum(['checking', 'savings']),
          accountNumber: z.string(),
          routingNumber: z.string(),
          accountHolder: z.string(),
          verified: z.boolean(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await initiateWireTransfer({
        userId: ctx.user.id,
        amount: input.amount,
        beneficiaryBank: input.beneficiaryBank,
        bankAccount: input.bankAccount,
      });
      return result;
    }),

  /**
   * Check transfer status
   */
  checkStatus: protectedProcedure
    .input(z.object({ transferId: z.string() }))
    .query(async ({ input }) => {
      const status = await getTransferStatus(input.transferId);
      return status;
    }),
});
