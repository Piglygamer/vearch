/**
 * Comprehensive Monitoring Service
 * Real-time monitoring of all system components with alerting
 */

import { getDb } from "../db";
import { transactions, wallets, implants, users } from "../../drizzle/schema";
import { eq, gte, lt } from "drizzle-orm";

interface MetricSnapshot {
  timestamp: Date;
  metric: string;
  value: number;
  unit: string;
  threshold?: number;
  status: "healthy" | "warning" | "critical";
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

const metrics: MetricSnapshot[] = [];
const alerts: Alert[] = [];

/**
 * Start comprehensive monitoring
 */
export async function startComprehensiveMonitoring(intervalMs: number = 30000): Promise<NodeJS.Timer> {
  console.log("[Monitoring] Comprehensive monitoring started");

  // Run immediately
  await performComprehensiveCheck();

  // Schedule recurring checks
  return setInterval(async () => {
    try {
      await performComprehensiveCheck();
    } catch (error) {
      console.error("[Monitoring] Check failed:", error);
    }
  }, intervalMs);
}

/**
 * Perform comprehensive system check
 */
async function performComprehensiveCheck(): Promise<void> {
  const db = await getDb();
  if (!db) {
    addAlert("critical", "Database Unavailable", "Cannot connect to database");
    return;
  }

  // Check transaction volume
  await checkTransactionVolume(db);

  // Check wallet health
  await checkWalletHealth(db);

  // Check implant status
  await checkImplantStatus(db);

  // Check user growth
  await checkUserGrowth(db);

  // Check payment success rate
  await checkPaymentSuccessRate(db);

  // Check system performance
  await checkSystemPerformance();

  // Analyze metrics for anomalies
  await analyzeMetricsForAnomalies();
}

/**
 * Check transaction volume
 */
async function checkTransactionVolume(db: any): Promise<void> {
  try {
    const allTxns = await db.select().from(transactions);

    // Count transactions in last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentTxns = allTxns.filter((t: any) => new Date(t.createdAt) > oneHourAgo);

    const volume = recentTxns.length;
    const threshold = 1000; // Alert if more than 1000 txns/hour

    recordMetric("transaction_volume_per_hour", volume, "transactions", threshold);

    if (volume > threshold) {
      addAlert("warning", "High Transaction Volume", `${volume} transactions in the last hour`);
    }
  } catch (error) {
    console.error("[Monitoring] Transaction volume check failed:", error);
  }
}

/**
 * Check wallet health
 */
async function checkWalletHealth(db: any): Promise<void> {
  try {
    const walletList = await db.select().from(wallets);

    // Check for wallets with low balance
    const lowBalanceWallets = walletList.filter((w: any) => parseFloat(w.balance) < 10);

    recordMetric("low_balance_wallets", lowBalanceWallets.length, "wallets");

    if (lowBalanceWallets.length > 0) {
      addAlert("info", "Low Balance Wallets", `${lowBalanceWallets.length} wallets have balance < $10`);
    }

    // Check total liquidity
    const totalBalance = walletList.reduce((sum: number, w: any) => sum + parseFloat(w.balance), 0);
    recordMetric("total_liquidity", totalBalance, "USD", 50000);

    if (totalBalance < 10000) {
      addAlert("warning", "Low System Liquidity", `Total system balance: $${totalBalance.toFixed(2)}`);
    }
  } catch (error) {
    console.error("[Monitoring] Wallet health check failed:", error);
  }
}

/**
 * Check implant status
 */
async function checkImplantStatus(db: any): Promise<void> {
  try {
    const implantList = await db.select().from(implants);

    // Count by status
    const activeCount = implantList.filter((i: any) => i.status === "active").length;
    const expiringCount = implantList.filter((i: any) => i.status === "expiring").length;
    const revokedCount = implantList.filter((i: any) => i.status === "revoked").length;

    recordMetric("active_implants", activeCount, "implants");
    recordMetric("expiring_implants", expiringCount, "implants");
    recordMetric("revoked_implants", revokedCount, "implants");

    if (expiringCount > 0) {
      addAlert("info", "Implants Expiring Soon", `${expiringCount} implants are expiring soon`);
    }
  } catch (error) {
    console.error("[Monitoring] Implant status check failed:", error);
  }
}

/**
 * Check user growth
 */
async function checkUserGrowth(db: any): Promise<void> {
  try {
    const userList = await db.select().from(users);
    const totalUsers = userList.length;

    // Count new users in last 24 hours
    const oneDayAgo = new Date(Date.now() - 86400000);
    const newUsers = userList.filter((u: any) => new Date(u.createdAt) > oneDayAgo).length;

    recordMetric("total_users", totalUsers, "users");
    recordMetric("new_users_24h", newUsers, "users");

    if (newUsers > 100) {
      addAlert("info", "Rapid User Growth", `${newUsers} new users in the last 24 hours`);
    }
  } catch (error) {
    console.error("[Monitoring] User growth check failed:", error);
  }
}

/**
 * Check payment success rate
 */
async function checkPaymentSuccessRate(db: any): Promise<void> {
  try {
    const allTxns = await db.select().from(transactions);

    // Get transactions from last 24 hours
    const oneDayAgo = new Date(Date.now() - 86400000);
    const recentTxns = allTxns.filter((t: any) => new Date(t.createdAt) > oneDayAgo);

    if (recentTxns.length === 0) return;

    const successCount = recentTxns.filter((t: any) => t.status === "completed").length;
    const failureCount = recentTxns.filter((t: any) => t.status === "failed").length;
    const successRate = (successCount / recentTxns.length) * 100;

    recordMetric("payment_success_rate", successRate, "%", 95);

    if (successRate < 95) {
      addAlert("warning", "Low Payment Success Rate", `Success rate: ${successRate.toFixed(2)}%`);
    }

    if (failureCount > 10) {
      addAlert("warning", "High Payment Failure Count", `${failureCount} failed transactions in 24h`);
    }
  } catch (error) {
    console.error("[Monitoring] Payment success rate check failed:", error);
  }
}

/**
 * Check system performance
 */
async function checkSystemPerformance(): Promise<void> {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const uptime = process.uptime();

    recordMetric("heap_memory_usage", heapUsedPercent, "%", 80);
    recordMetric("process_uptime", uptime, "seconds");

    if (heapUsedPercent > 80) {
      addAlert("warning", "High Memory Usage", `Heap usage: ${heapUsedPercent.toFixed(2)}%`);
    }
  } catch (error) {
    console.error("[Monitoring] Performance check failed:", error);
  }
}

/**
 * Analyze metrics for anomalies
 */
async function analyzeMetricsForAnomalies(): Promise<void> {
  try {
    // Get recent metrics
    const recentMetrics = metrics.slice(-100);

    // Group by metric type
    const metricsByType = new Map<string, MetricSnapshot[]>();
    for (const metric of recentMetrics) {
      if (!metricsByType.has(metric.metric)) {
        metricsByType.set(metric.metric, []);
      }
      metricsByType.get(metric.metric)!.push(metric);
    }

    // Analyze each metric type for anomalies
    metricsByType.forEach((metricValues, metricName) => {
      if (metricValues.length < 5) return; // Need at least 5 samples

    const values = metricValues.map((m: MetricSnapshot) => m.value);
    const average = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sq: number, n: number) => sq + Math.pow(n - average, 2), 0) / values.length);
      const latest = values[values.length - 1];

      // Alert if value is more than 2 standard deviations from mean
      if (Math.abs(latest - average) > 2 * stdDev) {
        addAlert(
          "info",
          `Anomaly Detected: ${metricName}`,
          `Value ${latest} is unusual (avg: ${average.toFixed(2)}, stdDev: ${stdDev.toFixed(2)})`
        );
      }
    });
  } catch (error) {
    console.error("[Monitoring] Anomaly analysis failed:", error);
  }
}

/**
 * Record a metric
 */
function recordMetric(metric: string, value: number, unit: string, threshold?: number): void {
  const status =
    threshold && value > threshold
      ? "critical"
      : threshold && value > threshold * 0.8
        ? "warning"
        : "healthy";

  metrics.push({
    timestamp: new Date(),
    metric,
    value,
    unit,
    threshold,
    status,
  });

  // Keep only last 1000 metrics
  if (metrics.length > 1000) {
    metrics.shift();
  }
}

/**
 * Add an alert
 */
function addAlert(severity: "info" | "warning" | "critical", title: string, message: string): void {
  const alert: Alert = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    severity,
    title,
    message,
    timestamp: new Date(),
    resolved: false,
  };

  alerts.push(alert);

  // Log alert
  console.log(`[Monitoring] [${severity.toUpperCase()}] ${title}: ${message}`);

  // Keep only last 1000 alerts
  if (alerts.length > 1000) {
    alerts.shift();
  }
}

/**
 * Get current metrics
 */
export function getMetrics(): MetricSnapshot[] {
  return metrics.slice(-50); // Return last 50 metrics
}

/**
 * Get current alerts
 */
export function getAlerts(): Alert[] {
  return alerts.slice(-50); // Return last 50 alerts
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): Alert[] {
  return alerts.filter((a) => !a.resolved).slice(-20);
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string): boolean {
  const alert = alerts.find((a) => a.id === alertId);
  if (alert) {
    alert.resolved = true;
    return true;
  }
  return false;
}

/**
 * Get monitoring dashboard data
 */
export async function getMonitoringDashboard(): Promise<any> {
  const db = await getDb();

  return {
    timestamp: new Date(),
    metrics: getMetrics(),
    activeAlerts: getActiveAlerts(),
    recentAlerts: alerts.slice(-10),
    systemStatus: getActiveAlerts().length === 0 ? "healthy" : "degraded",
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
}

export default {
  startComprehensiveMonitoring,
  getMetrics,
  getAlerts,
  getActiveAlerts,
  resolveAlert,
  getMonitoringDashboard,
};
