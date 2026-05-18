/**
 * Automated Fidesmo Deployment Service
 * 
 * Integrates Fidesmo SDK (fdsm) into Vearch backend for automated applet deployment.
 * Users can deploy applets to their Apex Flex implants directly from the website.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

interface DeploymentRequest {
  userId: number;
  implantUid: string;
  appletPath: string; // Path to compiled .cap file
  appId: string; // Fidesmo App ID
  authToken: string; // Fidesmo auth token
}

interface DeploymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
  status: "pending" | "deployed" | "failed";
}

/**
 * Deploy applet to Apex Flex implant via Fidesmo
 */
export async function deployAppletToImplant(
  request: DeploymentRequest
): Promise<DeploymentResult> {
  try {
    // 1. Validate applet file exists
    if (!fs.existsSync(request.appletPath)) {
      throw new Error(`Applet file not found: ${request.appletPath}`);
    }

    // 2. Build fdsm deployment command
    const fidesmoCommand = buildFidesmoCommand(request);

    console.log(`[Fidesmo] Deploying applet to implant ${request.implantUid}`);
    console.log(`[Fidesmo] Command: ${fidesmoCommand}`);

    // 3. Execute fdsm deployment
    const { stdout, stderr } = await execAsync(fidesmoCommand, {
      timeout: 60000, // 60 second timeout
      env: {
        ...process.env,
        FIDESMO_AUTH: request.authToken,
        FIDESMO_APPID: request.appId,
      },
    });

    console.log(`[Fidesmo] Deployment output:`, stdout);

    // 4. Parse deployment result
    const transactionId = parseTransactionId(stdout);
    if (!transactionId) {
      throw new Error("Failed to parse transaction ID from Fidesmo response");
    }

    // 5. Poll deployment status
    const deploymentStatus = await pollDeploymentStatus(
      transactionId,
      request.authToken
    );

    return {
      success: deploymentStatus === "deployed",
      transactionId,
      message: `Applet deployed to ${request.implantUid}`,
      status: deploymentStatus as "pending" | "deployed" | "failed",
    };
  } catch (error) {
    console.error("[Fidesmo] Deployment error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Deployment failed",
      status: "failed",
    };
  }
}

/**
 * Build fdsm command for applet deployment
 */
function buildFidesmoCommand(request: DeploymentRequest): string {
  // fdsm install-applet --app-id <id> --cap <file> --aid <aid>
  const appletAid = process.env.VEARCH_APPLET_AID || "A000000004564541524348";

  return `java -jar /opt/fdsm/fdsm.jar install-applet \
    --app-id ${request.appId} \
    --cap ${request.appletPath} \
    --aid ${appletAid} \
    --verbose`;
}

/**
 * Parse transaction ID from fdsm output
 */
function parseTransactionId(output: string): string | null {
  // Look for transaction ID in output
  const match = output.match(/Transaction ID: ([a-f0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Poll Fidesmo API for deployment status
 */
async function pollDeploymentStatus(
  transactionId: string,
  authToken: string,
  maxAttempts: number = 30
): Promise<string> {
  const fidesmoApiUrl = process.env.FIDESMO_API_URL || "https://api.fidesmo.com";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `${fidesmoApiUrl}/v1/transactions/${transactionId}`,
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
      const status = data.status?.toLowerCase();

      console.log(
        `[Fidesmo] Deployment status (attempt ${attempt + 1}): ${status}`
      );

      if (status === "deployed" || status === "failed") {
        return status;
      }

      // Wait 2 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[Fidesmo] Status poll error:`, error);
    }
  }

  return "pending";
}

/**
 * Get list of deployed applets for user
 */
export async function getDeployedApplets(
  userId: number,
  authToken: string
): Promise<any[]> {
  try {
    const fidesmoApiUrl = process.env.FIDESMO_API_URL || "https://api.fidesmo.com";

    const response = await fetch(`${fidesmoApiUrl}/v1/applets`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return data.applets || [];
  } catch (error) {
    console.error("[Fidesmo] Error fetching applets:", error);
    return [];
  }
}

/**
 * Compile Java Card applet to CAP format
 */
export async function compileApplet(
  sourcePath: string,
  outputPath: string
): Promise<boolean> {
  try {
    // Use ant-javacard to compile
    const compileCommand = `ant-javacard \
      -input ${sourcePath} \
      -output ${outputPath} \
      -javacard 3.0.5`;

    console.log(`[Applet] Compiling: ${compileCommand}`);

    await execAsync(compileCommand, {
      timeout: 30000,
    });

    // Verify output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error("Compilation failed - output file not created");
    }

    console.log(`[Applet] Compiled successfully: ${outputPath}`);
    return true;
  } catch (error) {
    console.error("[Applet] Compilation error:", error);
    return false;
  }
}
