import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Auto-create wallet for new users
      try {
        const user = await db.getUserByOpenId(userInfo.openId);
        const database = await db.getDb();
        if (database && user) {
          const { wallets } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          
          const existingWallet = await database
            .select()
            .from(wallets)
            .where(eq(wallets.userId, user.id))
            .limit(1);
          
          if (existingWallet.length === 0) {
            await database.insert(wallets).values({
              userId: user.id,
              walletType: "prepaid",
              fundingSourceId: `wallet_${user.id}`,
              balance: "0.00",
              currency: "USD",
              status: "active",
              linkedAt: new Date(),
            } as any);
          }
        }
      } catch (walletError) {
        console.error("[OAuth] Failed to create wallet:", walletError);
        // Don't fail OAuth if wallet creation fails
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
