/**
 * REAL Fidesmo API Client
 * 
 * This is NOT simulated. It makes actual API calls to Fidesmo's production servers
 * to deploy real applets to real NFC chips.
 * 
 * Fidesmo API Documentation: https://developer.fidesmo.com/docs
 */

// Use native fetch (available in Node 18+)

const FIDESMO_API_BASE = "https://api.fidesmo.com";
const FIDESMO_APP_ID = process.env.FIDESMO_APP_ID || "34ab5711";
const FIDESMO_API_KEY = process.env.FIDESMO_API_KEY || "";

export interface FidesmoAppletConfig {
  aid: string; // Application ID (e.g., "A000000004564541524348")
  pan: string; // Primary Account Number
  cvv: string; // Card Verification Value
  expiry: string; // Card expiry (MMYY)
  implantUid: string; // Chip UID
}

export interface DeploymentResponse {
  deploymentId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  chipUid: string;
  appletAid: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface DeploymentStatus {
  deploymentId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  chipUid: string;
  error?: string;
}

/**
 * Deploy EMV applet to real NFC chip via Fidesmo
 * 
 * This makes a REAL API call to Fidesmo to deploy the applet.
 * The chip must be tapped on the user's phone running Fidesmo app.
 */
export async function deployAppletToChip(
  config: FidesmoAppletConfig
): Promise<DeploymentResponse> {
  try {
    if (!FIDESMO_API_KEY) {
      throw new Error("FIDESMO_API_KEY not configured");
    }

    // 1. Create deployment request
    const deploymentPayload = {
      appId: FIDESMO_APP_ID,
      chipUid: config.implantUid,
      applet: {
        aid: config.aid,
        data: {
          pan: config.pan,
          cvv: config.cvv,
          expiry: config.expiry,
        },
      },
    };

    // 2. Call Fidesmo API to initiate deployment
    const deployResponse = await fetch(`${FIDESMO_API_BASE}/v1/deployments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIDESMO_API_KEY}`,
      },
      body: JSON.stringify(deploymentPayload),
    });

    if (!deployResponse.ok) {
      const error = await deployResponse.text();
      throw new Error(`Fidesmo API error: ${deployResponse.status} - ${error}`);
    }

    const deployment = (await deployResponse.json()) as any;

    return {
      deploymentId: deployment.id,
      status: deployment.status || "pending",
      chipUid: config.implantUid,
      appletAid: config.aid,
      createdAt: deployment.createdAt || new Date().toISOString(),
      updatedAt: deployment.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Fidesmo] Deployment failed:", error);
    return {
      deploymentId: "",
      status: "failed",
      chipUid: config.implantUid,
      appletAid: config.aid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check real deployment status from Fidesmo
 * 
 * This queries the actual Fidesmo API for deployment status.
 */
export async function checkDeploymentStatus(
  deploymentId: string
): Promise<DeploymentStatus> {
  try {
    if (!FIDESMO_API_KEY) {
      throw new Error("FIDESMO_API_KEY not configured");
    }

    const response = await fetch(
      `${FIDESMO_API_BASE}/v1/deployments/${deploymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${FIDESMO_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fidesmo API error: ${response.status}`);
    }

    const deployment = (await response.json()) as any;

    return {
      deploymentId: deployment.id,
      status: deployment.status || "pending",
      progress: getProgressFromStatus(deployment.status),
      chipUid: deployment.chipUid,
      error: deployment.error,
    };
  } catch (error) {
    console.error("[Fidesmo] Status check failed:", error);
    return {
      deploymentId,
      status: "failed",
      progress: 0,
      chipUid: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get list of all deployments for an app
 */
export async function listDeployments(
  limit: number = 50,
  offset: number = 0
): Promise<DeploymentResponse[]> {
  try {
    if (!FIDESMO_API_KEY) {
      throw new Error("FIDESMO_API_KEY not configured");
    }

    const response = await fetch(
      `${FIDESMO_API_BASE}/v1/deployments?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${FIDESMO_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fidesmo API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return (data.deployments || []).map((d: any) => ({
      deploymentId: d.id,
      status: d.status,
      chipUid: d.chipUid,
      appletAid: d.applet?.aid,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  } catch (error) {
    console.error("[Fidesmo] List deployments failed:", error);
    return [];
  }
}

/**
 * Cancel a pending deployment
 */
export async function cancelDeployment(deploymentId: string): Promise<boolean> {
  try {
    if (!FIDESMO_API_KEY) {
      throw new Error("FIDESMO_API_KEY not configured");
    }

    const response = await fetch(
      `${FIDESMO_API_BASE}/v1/deployments/${deploymentId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIDESMO_API_KEY}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("[Fidesmo] Cancel deployment failed:", error);
    return false;
  }
}

/**
 * Get webhook events for deployments
 * 
 * Fidesmo sends webhook events when deployments complete.
 * This validates webhook signatures to ensure authenticity.
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return hash === signature;
}

/**
 * Helper: Convert status to progress percentage
 */
function getProgressFromStatus(status: string): number {
  const progressMap: Record<string, number> = {
    pending: 10,
    in_progress: 50,
    completed: 100,
    failed: 0,
  };
  return progressMap[status] || 0;
}

/**
 * Helper: Generate Fidesmo deeplink for manual deployment
 * 
 * If API deployment fails, users can tap manually via Fidesmo app.
 */
export function generateFidesmoDeeplink(config: {
  appId: string;
  chipUid: string;
  appletAid: string;
  pan: string;
  cvv: string;
  expiry: string;
}): string {
  const params = new URLSearchParams({
    app_id: config.appId,
    chip_uid: config.chipUid,
    applet_aid: config.appletAid,
    pan: config.pan,
    cvv: config.cvv,
    expiry: config.expiry,
  });

  return `https://fidesmo.com/app/deploy?${params.toString()}`;
}
