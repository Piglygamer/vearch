/**
 * Web NFC Service: Handle implant scanning and linking
 * Uses Web NFC API to read Apex Flex implant data
 */

export interface NFCImplantData {
  implantId: string;
  implantType: string;
  chipType: string;
  firmwareVersion: string;
  publicKey?: string;
  balance?: number;
  lastTransaction?: string;
}

export interface NFCReadResult {
  success: boolean;
  data?: NFCImplantData;
  error?: string;
}

/**
 * Check if Web NFC is supported
 */
export function isNFCSupported(): boolean {
  return "NDEFReader" in window;
}

/**
 * Scan for NFC implant
 */
export async function scanImplant(): Promise<NFCReadResult> {
  if (!isNFCSupported()) {
    return {
      success: false,
      error: "Web NFC is not supported on this device",
    };
  }

  try {
    const ndef = (window as any).NDEFReader;
    const reader = new ndef();

    // Listen for NFC tag detection
    reader.onreading = (event: any) => {
      const decoder = new TextDecoder();
      for (const record of event.message.records) {
        if (record.recordType === "text") {
          const text = decoder.decode(record.data);
          const implantData = parseImplantData(text);
          return {
            success: true,
            data: implantData,
          };
        }
      }
    };

    reader.onreadingerror = () => {
      return {
        success: false,
        error: "Failed to read NFC tag",
      };
    };

    // Start scanning
    await reader.scan();

    // Return scanning started
    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error("[NFC] Scan error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "NFC scan failed",
    };
  }
}

/**
 * Parse implant data from NFC tag
 */
function parseImplantData(nfcData: string): NFCImplantData {
  try {
    // Try to parse as JSON first
    const data = JSON.parse(nfcData);
    return {
      implantId: data.implantId || "UNKNOWN",
      implantType: data.implantType || "Apex Flex",
      chipType: data.chipType || "NXP MIFARE",
      firmwareVersion: data.firmwareVersion || "1.0.0",
      publicKey: data.publicKey,
      balance: data.balance,
      lastTransaction: data.lastTransaction,
    };
  } catch {
    // If not JSON, parse as delimited string
    // Format: IMPLANT_ID|TYPE|CHIP|FIRMWARE|PUBKEY
    const parts = nfcData.split("|");
    return {
      implantId: parts[0] || "UNKNOWN",
      implantType: parts[1] || "Apex Flex",
      chipType: parts[2] || "NXP MIFARE",
      firmwareVersion: parts[3] || "1.0.0",
      publicKey: parts[4],
    };
  }
}

/**
 * Write data to NFC implant (for provisioning)
 */
export async function writeToImplant(data: NFCImplantData): Promise<NFCReadResult> {
  if (!isNFCSupported()) {
    return {
      success: false,
      error: "Web NFC is not supported on this device",
    };
  }

  try {
    const ndef = (window as any).NDEFReader;
    const writer = new ndef();

    const encoder = new TextEncoder();
    const message = {
      records: [
        {
          recordType: "text",
          data: encoder.encode(JSON.stringify(data)),
        },
      ],
    };

    await writer.write(message);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[NFC] Write error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "NFC write failed",
    };
  }
}

/**
 * Link implant to user account
 */
export async function linkImplant(
  implantData: NFCImplantData
): Promise<{ success: boolean; error?: string; implantId?: string }> {
  try {
    const response = await fetch("/api/implants/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        implantId: implantData.implantId,
        implantType: implantData.implantType,
        chipType: implantData.chipType,
        firmwareVersion: implantData.firmwareVersion,
        publicKey: implantData.publicKey,
      }),
    });

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        implantId: implantData.implantId,
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to link implant",
      };
    }
  } catch (error) {
    console.error("[NFC] Link error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link implant",
    };
  }
}

/**
 * Authorize payment from implant
 */
export async function authorizePaymentFromImplant(
  implantId: string,
  amount: number,
  merchantId: string
): Promise<{ success: boolean; authCode?: string; error?: string }> {
  try {
    const response = await fetch("/api/applet/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        implantId,
        amount,
        merchantId,
        timestamp: Math.floor(Date.now() / 1000),
        transactionId: `TXN_${Date.now()}`,
      }),
    });

    const result = await response.json();

    if (result.authorized) {
      return {
        success: true,
        authCode: result.authCode,
      };
    } else {
      return {
        success: false,
        error: result.declineReason || "Payment authorization failed",
      };
    }
  } catch (error) {
    console.error("[NFC] Authorization error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Authorization failed",
    };
  }
}

/**
 * Get implant balance
 */
export async function getImplantBalance(
  implantId: string
): Promise<{ balance: number; currency: string; error?: string }> {
  try {
    const response = await fetch(`/api/applet/balance?implantId=${implantId}`);
    const result = await response.json();

    if (result.balance !== undefined) {
      return {
        balance: result.balance,
        currency: result.currency || "USD",
      };
    } else {
      return {
        balance: 0,
        currency: "USD",
        error: result.error || "Failed to get balance",
      };
    }
  } catch (error) {
    console.error("[NFC] Balance query error:", error);
    return {
      balance: 0,
      currency: "USD",
      error: error instanceof Error ? error.message : "Failed to get balance",
    };
  }
}

/**
 * Stop NFC scanning
 */
export async function stopScanning(): Promise<void> {
  if (!isNFCSupported()) {
    return;
  }

  try {
    const ndef = (window as any).NDEFReader;
    // Note: NDEFReader doesn't have a built-in stop method
    // Scanning stops when the page loses focus or is navigated away
    console.log("[NFC] Scanning stopped");
  } catch (error) {
    console.error("[NFC] Stop error:", error);
  }
}
