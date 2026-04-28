import { Router, Request, Response } from "express";
import { getMonitoringDashboard, getMetrics, getAlerts, getActiveAlerts, resolveAlert } from "../services/monitoringService";

const router = Router();

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive monitoring dashboard
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const dashboard = await getMonitoringDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[Monitoring API] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get current metrics
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = getMetrics();
    res.json({ metrics });
  } catch (error) {
    console.error("[Monitoring API] Metrics error:", error);
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get all recent alerts
 */
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const alerts = getAlerts();
    res.json({ alerts });
  } catch (error) {
    console.error("[Monitoring API] Alerts error:", error);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

/**
 * GET /api/monitoring/alerts/active
 * Get active (unresolved) alerts
 */
router.get("/alerts/active", async (req: Request, res: Response) => {
  try {
    const activeAlerts = getActiveAlerts();
    res.json({ alerts: activeAlerts });
  } catch (error) {
    console.error("[Monitoring API] Active alerts error:", error);
    res.status(500).json({ error: "Failed to get active alerts" });
  }
});

/**
 * POST /api/monitoring/alerts/:id/resolve
 * Resolve an alert
 */
router.post("/alerts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resolved = resolveAlert(id);

    if (resolved) {
      res.json({ success: true, message: "Alert resolved" });
    } else {
      res.status(404).json({ error: "Alert not found" });
    }
  } catch (error) {
    console.error("[Monitoring API] Resolve alert error:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

export default router;
