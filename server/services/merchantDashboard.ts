/**
 * Merchant Dashboard Service
 * Provides analytics, settlement reporting, and merchant tools
 */

import { getDb } from '../db';
import { transactions, users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export interface MerchantStats {
  totalTransactions: number;
  totalVolume: number;
  averageTransaction: number;
  successRate: number;
  dailyTransactions: number;
  weeklyTransactions: number;
  monthlyTransactions: number;
}

export interface TransactionAnalytics {
  date: string;
  transactionCount: number;
  totalVolume: number;
  averageAmount: number;
  successCount: number;
  failureCount: number;
}

export interface SettlementReport {
  settlementId: string;
  period: string;
  startDate: Date;
  endDate: Date;
  totalTransactions: number;
  totalVolume: number;
  fees: number;
  netSettlement: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Get merchant dashboard stats
 */
export async function getMerchantStats(userId: number): Promise<MerchantStats> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        totalTransactions: 0,
        totalVolume: 0,
        averageTransaction: 0,
        successRate: 0,
        dailyTransactions: 0,
        weeklyTransactions: 0,
        monthlyTransactions: 0,
      };
    }

    // Get all transactions for user
    const allTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    if (allTransactions.length === 0) {
      return {
        totalTransactions: 0,
        totalVolume: 0,
        averageTransaction: 0,
        successRate: 0,
        dailyTransactions: 0,
        weeklyTransactions: 0,
        monthlyTransactions: 0,
      };
    }

    // Calculate stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const totalVolume = allTransactions.reduce(
      (sum, t) => sum + parseFloat(t.amount.toString()),
      0
    );

    const successCount = allTransactions.filter((t) => t.status === 'completed').length;
    const successRate = (successCount / allTransactions.length) * 100;

    const dailyTransactions = allTransactions.filter((t) => {
      const txDate = new Date(t.createdAt);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === today.getTime();
    }).length;

    const weeklyTransactions = allTransactions.filter((t) => {
      const txDate = new Date(t.createdAt);
      return txDate >= weekAgo;
    }).length;

    const monthlyTransactions = allTransactions.filter((t) => {
      const txDate = new Date(t.createdAt);
      return txDate >= monthAgo;
    }).length;

    return {
      totalTransactions: allTransactions.length,
      totalVolume,
      averageTransaction: totalVolume / allTransactions.length,
      successRate,
      dailyTransactions,
      weeklyTransactions,
      monthlyTransactions,
    };
  } catch (error) {
    console.error('[MerchantDashboard] Stats error:', error);
    return {
      totalTransactions: 0,
      totalVolume: 0,
      averageTransaction: 0,
      successRate: 0,
      dailyTransactions: 0,
      weeklyTransactions: 0,
      monthlyTransactions: 0,
    };
  }
}

/**
 * Get transaction analytics for date range
 */
export async function getTransactionAnalytics(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<TransactionAnalytics[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    // Group by date
    const byDate: Record<string, typeof txList> = {};

    txList.forEach((tx) => {
      const txDate = new Date(tx.createdAt);
      if (txDate >= startDate && txDate <= endDate) {
        const dateKey = txDate.toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = [];
        }
        byDate[dateKey].push(tx);
      }
    });

    // Calculate analytics per date
    const analytics: TransactionAnalytics[] = Object.entries(byDate).map(([date, dayTxs]) => {
      const volume = dayTxs.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
      const successCount = dayTxs.filter((t) => t.status === 'completed').length;
      const failureCount = dayTxs.filter((t) => t.status === 'failed').length;

      return {
        date,
        transactionCount: dayTxs.length,
        totalVolume: volume,
        averageAmount: volume / dayTxs.length,
        successCount,
        failureCount,
      };
    });

    return analytics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('[MerchantDashboard] Analytics error:', error);
    return [];
  }
}

/**
 * Generate settlement report
 */
export async function generateSettlementReport(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<SettlementReport> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        settlementId: '',
        period: '',
        startDate,
        endDate,
        totalTransactions: 0,
        totalVolume: 0,
        fees: 0,
        netSettlement: 0,
        status: 'pending',
      };
    }

    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    // Filter by date range
    const settlementTxs = txList.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      return txDate >= startDate && txDate <= endDate;
    });

    const totalVolume = settlementTxs.reduce(
      (sum, t) => sum + parseFloat(t.amount.toString()),
      0
    );

    // Calculate fees (2.9% + $0.30 per transaction)
    const transactionFee = settlementTxs.length * 0.3;
    const percentageFee = totalVolume * 0.029;
    const totalFees = transactionFee + percentageFee;

    const settlementId = `settle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const period = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;

    return {
      settlementId,
      period,
      startDate,
      endDate,
      totalTransactions: settlementTxs.length,
      totalVolume,
      fees: totalFees,
      netSettlement: totalVolume - totalFees,
       status: 'completed',
    };
  } catch (error) {
    console.error('[MerchantDashboard] Settlement error:', error);
    return {
      settlementId: '',
      period: '',
      startDate,
      endDate,
      totalTransactions: 0,
      totalVolume: 0,
      fees: 0,
      netSettlement: 0,
      status: 'pending',
    };
  }
}

/**
 * Get top merchants by volume
 */
export async function getTopMerchants(
  userId: number,
  limit: number = 10
): Promise<
  Array<{
    merchantName: string;
    transactionCount: number;
    totalVolume: number;
  }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    // Group by merchant
    const byMerchant: Record<
      string,
      {
        count: number;
        volume: number;
      }
    > = {};

    txList.forEach((tx) => {
      const merchantName = tx.description || 'Unknown';
      if (!byMerchant[merchantName]) {
        byMerchant[merchantName] = { count: 0, volume: 0 };
      }
      byMerchant[merchantName].count += 1;
      byMerchant[merchantName].volume += parseFloat(tx.amount.toString());
    });

    // Sort by volume and return top
    return Object.entries(byMerchant)
      .map(([merchantName, data]) => ({
        merchantName,
        transactionCount: data.count,
        totalVolume: data.volume,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);
  } catch (error) {
    console.error('[MerchantDashboard] Top merchants error:', error);
    return [];
  }
}

/**
 * Export transactions to CSV
 */
export async function exportTransactionsCSV(userId: number): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return '';

    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    // Create CSV header
    let csv = 'Date,Type,Amount,Currency,Status,Description\n';

    // Add rows
    txList.forEach((tx) => {
      const date = new Date(tx.createdAt).toISOString().split('T')[0];
      const amount = tx.amount.toString();
      const description = (tx.description || '').replace(/,/g, ';'); // Escape commas

      csv += `${date},${tx.transactionType},${amount},${tx.currency},${tx.status},"${description}"\n`;
    });

    return csv;
  } catch (error) {
    console.error('[MerchantDashboard] Export error:', error);
    return '';
  }
}
