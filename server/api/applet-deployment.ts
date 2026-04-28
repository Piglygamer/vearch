import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { implants } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createFedezmoDeployer } from "../../applet/FedezmoDeployer";

const router = Router();

/**
 * POST /api/applet-deployment/register
 * Register an implant with Fedezmo and deploy applet
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { implantId, userId } = req.body;

    if (!implantId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Check if implant already registered
    const existing = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Implant already registered" });
    }

    // Register with Fedezmo
    const fedezmoKey = process.env.FEDEZMO_API_KEY || "";
    const deployer = createFedezmoDeployer(fedezmoKey);

    const registration = await deployer.registerImplant(implantId, userId.toString());

    if (!registration.success) {
      return res.status(400).json({ error: registration.message });
    }

    // Store in database
    await db.insert(implants).values({
      userId,
      implantId,
      implantType: "apex_flex",
      status: "active",
      linkedAt: new Date(),
    });

    res.json({
      success: true,
      implantId,
      registrationId: registration.registrationId,
      message: "Implant registered and applet deployed",
    });
  } catch (error) {
    console.error("[Applet Deployment] Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/applet-deployment/update
 * Push applet update to implants
 */
router.post("/update", async (req: Request, res: Response) => {
  try {
    const { implantIds, version } = req.body;

    if (!implantIds || !Array.isArray(implantIds) || !version) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Push updates via Fedezmo
    const fedezmoKey = process.env.FEDEZMO_API_KEY || "";
    const deployer = createFedezmoDeployer(fedezmoKey);

    const results = await deployer.pushUpdate(implantIds, version);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.json({
      success: failed === 0,
      updated: successful,
      failed,
      results,
      message: `Update pushed to ${successful} implants, ${failed} failed`,
    });
  } catch (error) {
    console.error("[Applet Deployment] Update error:", error);
    res.status(500).json({ error: "Update failed" });
  }
});

/**
 * GET /api/applet-deployment/status/:implantId
 * Get applet status on implant
 */
router.get("/status/:implantId", async (req: Request, res: Response) => {
  try {
    const { implantId } = req.params;

    if (!implantId) {
      return res.status(400).json({ error: "Missing implant ID" });
    }

    // Get status from Fedezmo
    const fedezmoKey = process.env.FEDEZMO_API_KEY || "";
    const deployer = createFedezmoDeployer(fedezmoKey);

    const status = await deployer.getImplantStatus(implantId);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("[Applet Deployment] Status error:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

/**
 * POST /api/applet-deployment/revoke/:implantId
 * Revoke applet access from implant
 */
router.post("/revoke/:implantId", async (req: Request, res: Response) => {
  try {
    const { implantId } = req.params;

    if (!implantId) {
      return res.status(400).json({ error: "Missing implant ID" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Revoke via Fedezmo
    const fedezmoKey = process.env.FEDEZMO_API_KEY || "";
    const deployer = createFedezmoDeployer(fedezmoKey);

    const revocation = await deployer.revokeImplant(implantId);

    if (!revocation.success) {
      return res.status(400).json({ error: revocation.message });
    }

    // Update database
    const implantRecord = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (implantRecord && implantRecord.length > 0) {
      await db
        .update(implants)
        .set({ status: "revoked" })
        .where(eq(implants.implantId, implantId));
    }

    res.json({
      success: true,
      implantId,
      message: "Applet access revoked",
    });
  } catch (error) {
    console.error("[Applet Deployment] Revocation error:", error);
    res.status(500).json({ error: "Revocation failed" });
  }
});

/**
 * POST /api/applet-deployment/publish-update
 * Publish applet update
 */
router.post("/publish-update", async (req: Request, res: Response) => {
  try {
    const { version, releaseNotes, mandatory } = req.body;

    if (!version || !releaseNotes) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create and publish update via Fedezmo
    const fedezmoKey = process.env.FEDEZMO_API_KEY || "";
    const deployer = createFedezmoDeployer(fedezmoKey);

    const update = deployer.createUpdateManifest(version, releaseNotes, mandatory || false);
    const result = await deployer.publishUpdateManifest(update);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      updateId: result.updateId,
      version,
      message: result.message,
    });
  } catch (error) {
    console.error("[Applet Deployment] Publish error:", error);
    res.status(500).json({ error: "Publication failed" });
  }
});

/**
 * GET /api/applet-deployment/history
 * Get deployment history
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const fedezmoKey = process.env.FEDEZMO_API_KEY || "";
    const deployer = createFedezmoDeployer(fedezmoKey);

    const history = deployer.getDeploymentHistory();

    res.json({
      success: true,
      deployments: history,
      count: history.length,
    });
  } catch (error) {
    console.error("[Applet Deployment] History error:", error);
    res.status(500).json({ error: "Failed to get history" });
  }
});

export default router;
