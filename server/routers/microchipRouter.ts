/**
 * @deprecated Legacy simulator.
 *
 * The chip is not running an EMV applet — it stores only a UID. The real
 * link path is `implantsBridge.link` (server/routers/implantsBridgeRouter.ts)
 * which calls `linkImplant` in `server/services/implantLink.ts`. This router
 * is kept mounted to avoid breaking the legacy MicrochipDeployment page and
 * will be removed in a follow-up PR.
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as javaCard from "../services/javaCardApplet";

export const microchipRouter = router({
  // Deploy Stripe card to microchip
  deployCard: protectedProcedure
    .input(
      z.object({
        stripeCardId: z.string(),
        cardholderName: z.string(),
        pan: z.string(),
        cvv: z.string(),
        expiry: z.string(),
        pin: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = javaCard.deployToMicrochip({
          stripeCardId: input.stripeCardId,
          cardholderName: input.cardholderName,
          pan: input.pan,
          cvv: input.cvv,
          expiry: input.expiry,
          pin: input.pin,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to deploy card to microchip",
          });
        }

        return {
          success: true,
          microchipId: result.microchipId,
          atr: result.atr,
          aid: result.aid,
          deploymentCode: result.deploymentCode,
          message: result.message,
        };
      } catch (error) {
        console.error("Error deploying card:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deploy card to microchip",
        });
      }
    }),

  // Get deployment package (bytecode + APDUs)
  getDeploymentPackage: protectedProcedure
    .input(
      z.object({
        stripeCardId: z.string(),
        cardholderName: z.string(),
        pan: z.string(),
        cvv: z.string(),
        expiry: z.string(),
      })
    )
    .query(({ input }) => {
      try {
        const card: javaCard.MicrochipCard = {
          id: `MC-${Date.now()}`,
          stripeCardId: input.stripeCardId,
          pan: input.pan,
          cvv: input.cvv,
          expiry: input.expiry,
          cardholderName: input.cardholderName,
          balance: 0,
          deployed: false,
          transactionCounter: 0,
          atr: "3B8E0001C0",
          aid: "A0000000045645415243",
        };

        const pkg = javaCard.createDeploymentPackage(card);

        return {
          success: true,
          bytecode: pkg.bytecode,
          apdus: pkg.apdus,
          manifest: pkg.manifest,
        };
      } catch (error) {
        console.error("Error generating deployment package:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate deployment package",
        });
      }
    }),

  // Verify microchip deployment
  verifyDeployment: protectedProcedure
    .input(
      z.object({
        microchipId: z.string(),
        deploymentCode: z.string(),
      })
    )
    .query(({ input }) => {
      try {
        const verified = javaCard.verifyMicrochipDeployment(
          input.microchipId,
          input.deploymentCode
        );

        return {
          success: verified,
          verified,
          message: verified
            ? "Microchip deployment verified successfully"
            : "Deployment verification failed",
        };
      } catch (error) {
        console.error("Error verifying deployment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify deployment",
        });
      }
    }),

  // Get microchip status
  getMicrochipStatus: protectedProcedure
    .input(z.object({ microchipId: z.string() }))
    .query(({ input }) => {
      try {
        const status = javaCard.getMicrochipStatus(input.microchipId);

        return {
          success: true,
          status: status.status,
          lastTransaction: status.lastTransaction,
          transactionCount: status.transactionCount,
          balance: status.balance,
        };
      } catch (error) {
        console.error("Error getting microchip status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get microchip status",
        });
      }
    }),

  // Simulate terminal transaction
  processTerminalTransaction: protectedProcedure
    .input(
      z.object({
        microchipId: z.string(),
        amount: z.number(),
        merchant: z.string(),
      })
    )
    .mutation(({ input }) => {
      try {
        const result = javaCard.processTerminalTransaction(
          input.microchipId,
          input.amount,
          input.merchant
        );

        return {
          success: result.success,
          transactionId: result.transactionId,
          authCode: result.authCode,
          balance: result.balance,
        };
      } catch (error) {
        console.error("Error processing terminal transaction:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process transaction",
        });
      }
    }),

  // Get deployment instructions
  getDeploymentInstructions: protectedProcedure.query(() => {
    return {
      success: true,
      instructions: [
        {
          step: 1,
          title: "Create Stripe Virtual Card",
          description: "Create a new virtual card in the Payment Emulator",
        },
        {
          step: 2,
          title: "Get Deployment Package",
          description: "Retrieve the Java Card applet bytecode and APDU commands",
        },
        {
          step: 3,
          title: "Connect Microchip",
          description: "Connect your Apex Flex microchip to a card reader",
        },
        {
          step: 4,
          title: "Deploy Applet",
          description: "Use the deployment package to install the applet on the microchip",
        },
        {
          step: 5,
          title: "Verify Deployment",
          description: "Verify the deployment was successful",
        },
        {
          step: 6,
          title: "Ready for Payments",
          description:
            "Your microchip is now ready to process payments at any terminal worldwide",
        },
      ],
    };
  }),
});
