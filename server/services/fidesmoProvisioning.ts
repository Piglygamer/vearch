import { getDb } from '../db';
import { implants, transactions } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Real Fidesmo NFC provisioning service
 * Deploys payment applets to actual NFC chips (no demo/sandbox)
 */

export interface FidesmoApplet {
  appletId: string;
  name: string;
  version: string;
  description: string;
  aid: string; // Application Identifier
  permissions: string[];
}

export interface ImplantProvisioningRequest {
  userId: number;
  implantId: string;
  nfcChipId: string;
  appletId: string;
  walletId: number;
  cardToken: string;
}

export interface ProvisioningResult {
  success: boolean;
  provisioningId: string;
  status: 'provisioned' | 'pending' | 'failed';
  implantId: string;
  appletId: string;
  message: string;
  timestamp: Date;
}

/**
 * Production Fidesmo applets (real, not demo)
 */
const PRODUCTION_APPLETS: Record<string, FidesmoApplet> = {
  vearch_payment_v1: {
    appletId: 'vearch_payment_v1',
    name: 'Vearch Payment Applet v1',
    version: '1.0.0',
    description: 'Real payment processing on NFC implant',
    aid: 'A0000002471001', // Vearch AID
    permissions: ['nfc_read', 'nfc_write', 'payment_processing', 'secure_element'],
  },
  vearch_payment_v2: {
    appletId: 'vearch_payment_v2',
    name: 'Vearch Payment Applet v2',
    version: '2.0.0',
    description: 'Enhanced payment with biometric support',
    aid: 'A0000002471002',
    permissions: ['nfc_read', 'nfc_write', 'payment_processing', 'secure_element', 'biometric'],
  },
};

/**
 * Provision a real NFC chip with payment applet
 * This deploys actual payment capability to the implant
 */
export async function provisionImplantChip(
  request: ImplantProvisioningRequest
): Promise<ProvisioningResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        provisioningId: '',
        status: 'failed',
        implantId: request.implantId,
        appletId: request.appletId,
        message: 'Database unavailable',
        timestamp: new Date(),
      };
    }

    // Verify applet exists
    const applet = PRODUCTION_APPLETS[request.appletId];
    if (!applet) {
      return {
        success: false,
        provisioningId: '',
        status: 'failed',
        implantId: request.implantId,
        appletId: request.appletId,
        message: `Applet ${request.appletId} not found`,
        timestamp: new Date(),
      };
    }

    // Generate provisioning ID
    const provisioningId = `prov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Call Fidesmo API to provision chip
    const fidesmoResponse = await deployToFidesmo({
      chipId: request.nfcChipId,
      appletId: request.appletId,
      applet,
      cardToken: request.cardToken,
      userId: request.userId,
    });

    if (!fidesmoResponse.success) {
      return {
        success: false,
        provisioningId,
        status: 'failed',
        implantId: request.implantId,
        appletId: request.appletId,
        message: fidesmoResponse.error || 'Unknown error',
        timestamp: new Date(),
      };
    }

    // Update implant with provisioning info
    await db
      .update(implants)
      .set({
        status: 'active',
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(implants.implantId, request.implantId));

    // Log provisioning transaction
    await db.insert(transactions).values({
      userId: request.userId,
      walletId: request.walletId,
      transactionType: 'transfer',
      amount: '0',
      currency: 'USD',
      status: 'completed',
      description: `Applet provisioned: ${applet.name} v${applet.version}`,
      metadata: JSON.stringify({
        provisioningId,
        chipId: request.nfcChipId,
        appletId: request.appletId,
        fidesmoResponse: fidesmoResponse.data,
      }),
    });

    return {
      success: true,
      provisioningId,
      status: 'provisioned',
      implantId: request.implantId,
      appletId: request.appletId,
      message: `Applet ${applet.name} successfully provisioned to chip`,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('[Fidesmo] Provisioning error:', error);
    return {
      success: false,
      provisioningId: '',
      status: 'failed',
      implantId: request.implantId,
      appletId: request.appletId,
      message: `Provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Deploy applet to Fidesmo production environment
 */
async function deployToFidesmo(input: {
  chipId: string;
  appletId: string;
  applet: FidesmoApplet;
  cardToken: string;
  userId: number;
}): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error: string;
}> {
  try {
    const fidesmoApiUrl = process.env.FIDESMO_API_URL || 'https://api.fidesmo.com/v1';
    const fidesmoApiKey = process.env.FIDESMO_API_KEY;

    if (!fidesmoApiKey) {
      return {
        success: false,
        error: 'Fidesmo API key not configured',
      };
    }

    // Call Fidesmo API to deploy applet to chip
    const response = await fetch(`${fidesmoApiUrl}/applets/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fidesmoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chipId: input.chipId,
        appletId: input.appletId,
        appletName: input.applet.name,
        appletVersion: input.applet.version,
        aid: input.applet.aid,
        permissions: input.applet.permissions,
        config: {
          cardToken: input.cardToken,
          userId: input.userId,
          paymentEnabled: true,
          tapLimit: 5000, // $5000 per tap
          dailyLimit: 50000, // $50,000 per day
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Fidesmo API error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
      error: '',
    };
  } catch (error) {
    console.error('[Fidesmo] API error:', error);
    return {
      success: false,
      error: `Fidesmo deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get provisioning status
 */
export async function getProvisioningStatus(provisioningId: string): Promise<{
  status: 'provisioned' | 'pending' | 'failed' | 'unknown';
  message: string;
}> {
  try {
    const fidesmoApiUrl = process.env.FIDESMO_API_URL || 'https://api.fidesmo.com/v1';
    const fidesmoApiKey = process.env.FIDESMO_API_KEY;

    if (!fidesmoApiKey) {
      return {
        status: 'unknown',
        message: 'Fidesmo API key not configured',
      };
    }

    const response = await fetch(`${fidesmoApiUrl}/provisioning/${provisioningId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${fidesmoApiKey}`,
      },
    });

    if (!response.ok) {
      return {
        status: 'unknown',
        message: `Status check failed: ${response.status}`,
      };
    }

    const data = (await response.json()) as { status: string; message: string };

    return {
      status: (data.status as 'provisioned' | 'pending' | 'failed') || 'unknown',
      message: data.message,
    };
  } catch (error) {
    return {
      status: 'unknown',
      message: `Error checking status: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * Update applet on already-provisioned chip
 */
export async function updateApplet(
  chipId: string,
  newAppletId: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const applet = PRODUCTION_APPLETS[newAppletId];
    if (!applet) {
      return {
        success: false,
        message: `Applet ${newAppletId} not found`,
      };
    }

    const fidesmoApiUrl = process.env.FIDESMO_API_URL || 'https://api.fidesmo.com/v1';
    const fidesmoApiKey = process.env.FIDESMO_API_KEY;

    if (!fidesmoApiKey) {
      return {
        success: false,
        message: 'Fidesmo API key not configured',
      };
    }

    const response = await fetch(`${fidesmoApiUrl}/applets/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fidesmoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chipId,
        appletId: newAppletId,
        appletVersion: applet.version,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Update failed: ${response.status}`,
      };
    }

    return {
      success: true,
      message: `Applet updated to ${applet.name} v${applet.version}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Update error: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * List available production applets
 */
export function getAvailableApplets(): FidesmoApplet[] {
  return Object.values(PRODUCTION_APPLETS);
}
