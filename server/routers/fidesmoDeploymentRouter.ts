/**
 * Fidesmo Deployment Router
 * 
 * tRPC endpoints for automated applet deployment to Apex Flex implants.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  deployAppletToImplant,
  getDeployedApplets,
  compileApplet,
} from "../services/fidesmoAutomatedDeployment";

export const fidesmoDeploymentRouter = router({
  /**
   * Deploy EMV applet to implant (main entry point)
   */
  deployToImplant: protectedProcedure
    .input(
      z.object({
        implantId: z.number(),
        implantUid: z.string(),
        implantType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const fidesmoAppId = process.env.FIDESMO_APP_ID;
        const vearchAppletAid = process.env.VEARCH_APPLET_AID;

        if (!fidesmoAppId || !vearchAppletAid) {
          throw new Error("Fidesmo credentials not configured");
        }

        const deploymentUrl = `https://fidesmo.com/app/${fidesmoAppId}/deploy?applet=${vearchAppletAid}&uid=${input.implantUid}`;

        console.log(
          `[Fidesmo] Deploying applet to implant ${input.implantUid} (${input.implantType})`
        );

        return {
          success: true,
          deploymentUrl,
          message: `Deployment initiated for ${input.implantType}`,
        };
      } catch (error) {
        console.error("[Fidesmo Deployment] Error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Deployment failed",
        };
      }
    }),

  /**
   * Deploy compiled applet to user's Apex Flex implant
   */
  deployApplet: protectedProcedure
    .input(
      z.object({
        implantUid: z.string(),
        appletCapPath: z.string(),
        appId: z.string().optional(),
        authToken: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        const appId = input.appId || process.env.FIDESMO_APP_ID || "";
        const authToken =
          input.authToken || process.env.FIDESMO_AUTH_TOKEN || "";

        if (!appId || !authToken) {
          throw new Error("Fidesmo credentials not configured");
        }

        const result = await deployAppletToImplant({
          userId: ctx.user.id,
          implantUid: input.implantUid,
          appletPath: input.appletCapPath,
          appId,
          authToken,
        });

        return {
          success: result.success,
          transactionId: result.transactionId,
          message: result.message,
          status: result.status,
        };
      } catch (error) {
        console.error("[Deployment] Error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Deployment failed",
          status: "failed" as const,
        };
      }
    }),

  /**
   * Get list of deployed applets
   */
  getDeployedApplets: protectedProcedure.query(async ({ ctx }: any) => {
    try {
      const authToken = process.env.FIDESMO_AUTH_TOKEN || "";
      if (!authToken) {
        throw new Error("Fidesmo credentials not configured");
      }

      const applets = await getDeployedApplets(ctx.user.id, authToken);
      return {
        success: true,
        applets,
      };
    } catch (error) {
      console.error("[Deployment] Error fetching applets:", error);
      return {
        success: false,
        applets: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch applets",
      };
    }
  }),

  /**
   * Compile Java Card applet to CAP format
   */
  compileApplet: protectedProcedure
    .input(
      z.object({
        sourcePath: z.string(),
        outputPath: z.string(),
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        const success = await compileApplet(input.sourcePath, input.outputPath);
        return {
          success,
          message: success
            ? "Applet compiled successfully"
            : "Applet compilation failed",
          outputPath: success ? input.outputPath : null,
        };
      } catch (error) {
        console.error("[Compilation] Error:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Compilation failed",
          outputPath: null,
        };
      }
    }),

  /**
   * Get deployment status
   */
  getDeploymentStatus: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(async ({ input }: any) => {
      try {
        const authToken = process.env.FIDESMO_AUTH_TOKEN || "";
        if (!authToken) {
          throw new Error("Fidesmo credentials not configured");
        }

        const fidesmoApiUrl =
          process.env.FIDESMO_API_URL || "https://api.fidesmo.com";

        const response = await fetch(
          `${fidesmoApiUrl}/v1/transactions/${input.transactionId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as any;
        return {
          success: true,
          status: data.status || "unknown",
          data,
        };
      } catch (error) {
        console.error("[Status] Error:", error);
        return {
          success: false,
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to get status",
        };
      }
    }),
});
