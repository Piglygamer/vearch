import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  getMerchantStats,
  getTransactionAnalytics,
  generateSettlementReport,
  getTopMerchants,
  exportTransactionsCSV,
} from '../services/merchantDashboard';

export const merchantDashboardRouter = router({
  /**
   * Get merchant dashboard stats
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getMerchantStats(ctx.user.id);
    return stats;
  }),

  /**
   * Get transaction analytics for date range
   */
  getAnalytics: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const analytics = await getTransactionAnalytics(
        ctx.user.id,
        input.startDate,
        input.endDate
      );
      return analytics;
    }),

  /**
   * Generate settlement report
   */
  generateSettlement: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const report = await generateSettlementReport(
        ctx.user.id,
        input.startDate,
        input.endDate
      );
      return report;
    }),

  /**
   * Get top merchants by volume
   */
  getTopMerchants: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const merchants = await getTopMerchants(ctx.user.id, input.limit);
      return merchants;
    }),

  /**
   * Export transactions to CSV
   */
  exportCSV: protectedProcedure.query(async ({ ctx }) => {
    const csv = await exportTransactionsCSV(ctx.user.id);
    return {
      csv,
      filename: `transactions-${new Date().toISOString().split('T')[0]}.csv`,
    };
  }),
});
