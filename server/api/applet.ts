import { Router, Request, Response } from "express";
import { getDb } from "../db";
import { transactions, implants, wallets, InsertTransaction } from "../../drizzle/schema";
import { getUserBankAccount } from "../services/bankService";
import { eq, gte, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

/**
 * Helper: Get user ID from implant ID
 */
async function getUserIdFromImplantId(implantId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const implantRecord = await db
    .select()
    .from(implants)
    .where(eq(implants.implantId, implantId))
    .limit(1);

  if (!implantRecord || implantRecord.length === 0) return null;
  return implantRecord[0].userId;
}

/**
 * POST /api/applet/link
 * Link an implant to a user's wallet
 */
router.post("/link", async (req: Request, res: Response) => {
  try {
    const { implantId, userId } = req.body;

    if (!implantId || !userId) {
      return res.status(400).json({ error: "Missing implant ID or user ID" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Check if implant already exists
    const existingImplant = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (existingImplant && existingImplant.length > 0) {
      return res.status(400).json({ error: "Implant already linked" });
    }

    // Create implant record
    await db.insert(implants).values({
      userId,
      implantId,
      implantType: "apex_flex",
      status: "active",
    });

    res.json({
      success: true,
      implantId,
      userId,
      message: "Implant linked successfully",
    });
  } catch (error) {
    console.error("[Applet API] Link failed:", error);
    res.status(500).json({ error: "Failed to link implant" });
  }
});

/**
 * GET /api/applet/status/:implantId
 * Get implant status
 */
router.get("/status/:implantId", async (req: Request, res: Response) => {
  try {
    const { implantId } = req.params;

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    const implantRecord = await db
      .select()
      .from(implants)
      .where(eq(implants.implantId, implantId))
      .limit(1);

    if (!implantRecord || implantRecord.length === 0) {
      return res.status(404).json({ error: "Implant not found" });
    }

    const implant = implantRecord[0];

    res.json({
      success: true,
      implantId,
      status: implant.status,
      linkedAt: implant.linkedAt,
      expiresAt: implant.expiresAt,
    });
  } catch (error) {
    console.error("[Applet API] Status check failed:", error);
    res.status(500).json({ error: "Failed to get implant status" });
  }
});

/**
 * POST /api/applet/unlink
 * Unlink an implant
 */
router.post("/unlink", async (req: Request, res: Response) => {
  try {
    const { implantId } = req.body;

    if (!implantId) {
      return res.status(400).json({ error: "Missing implant ID" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Update implant status to revoked
    await db
      .update(implants)
      .set({ status: "revoked" })
      .where(eq(implants.implantId, implantId));

    res.json({
      success: true,
      implantId,
      message: "Implant unlinked successfully",
    });
  } catch (error) {
    console.error("[Applet API] Unlink failed:", error);
    res.status(500).json({ error: "Failed to unlink implant" });
  }
});

export default router;
