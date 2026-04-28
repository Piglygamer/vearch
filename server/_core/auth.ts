import { Request, Response, NextFunction } from "express";
import { sdk } from "./sdk";
import type { User } from "../../drizzle/schema";

/**
 * Middleware to authenticate requests and attach user to request object
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error("[Auth] Authentication failed:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error("[Auth] Admin authentication failed:", error);
    res.status(403).json({ error: "Admin access required" });
  }
}

/**
 * Optional authentication middleware (doesn't fail if not authenticated)
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req);
    (req as any).user = user || null;
    next();
  } catch (error) {
    (req as any).user = null;
    next();
  }
}
