/**
 * Unified Payment Service
 * Supports PayPal, Cash App, and Venmo for deposits and withdrawals
 */

export type PaymentProvider = "paypal" | "cashapp" | "venmo";

export interface PaymentRequest {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  userId: number;
  walletId: number;
  description: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  provider: PaymentProvider;
  status: "pending" | "completed" | "failed";
  redirectUrl?: string;
  error?: string;
}

/**
 * PayPal Payment Handler
 */
async function handlePayPalPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    const PAYPAL_API_URL = process.env.PAYPAL_API_URL || "https://api.sandbox.paypal.com";
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.warn("[PayPal] Credentials not configured, using mock mode");
      return {
        success: true,
        transactionId: `paypal_${Date.now()}`,
        provider: "paypal",
        status: "completed",
      };
    }

    // Get access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
    const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get PayPal access token");
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    // Create payment
    const paymentResponse = await fetch(`${PAYPAL_API_URL}/v1/payments/payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "sale",
        payer: {
          payment_method: "paypal",
        },
        transactions: [
          {
            amount: {
              total: request.amount.toFixed(2),
              currency: request.currency,
            },
            description: request.description,
            custom: `user_${request.userId}_wallet_${request.walletId}`,
          },
        ],
        redirect_urls: {
          return_url: `${process.env.APP_URL || "http://localhost:3000"}/api/payments/paypal/return`,
          cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/api/payments/paypal/cancel`,
        },
      }),
    });

    if (!paymentResponse.ok) {
      throw new Error("Failed to create PayPal payment");
    }

    const paymentData = (await paymentResponse.json()) as any;
    const approvalUrl = paymentData.links?.find((link: any) => link.rel === "approval_url")?.href;

    return {
      success: true,
      transactionId: paymentData.id,
      provider: "paypal",
      status: "pending",
      redirectUrl: approvalUrl,
    };
  } catch (error) {
    console.error("[PayPal] Payment failed:", error);
    return {
      success: false,
      transactionId: "",
      provider: "paypal",
      status: "failed",
      error: String(error),
    };
  }
}

/**
 * Cash App Payment Handler
 */
async function handleCashAppPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    const CASHAPP_API_KEY = process.env.CASHAPP_API_KEY || "";

    if (!CASHAPP_API_KEY) {
      console.warn("[CashApp] API key not configured, using mock mode");
      return {
        success: true,
        transactionId: `cashapp_${Date.now()}`,
        provider: "cashapp",
        status: "completed",
      };
    }

    // Create Cash App payment request
    const paymentResponse = await fetch("https://api.square.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CASHAPP_API_KEY}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-04-17",
      },
      body: JSON.stringify({
        source_id: "cnp:card-nonce-ok",
        amount_money: {
          amount: Math.round(request.amount * 100),
          currency: request.currency,
        },
        idempotency_key: `cashapp_${request.userId}_${Date.now()}`,
        note: request.description,
        customer_id: `user_${request.userId}`,
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      throw new Error(`Cash App payment failed: ${errorData.errors?.[0]?.detail}`);
    }

    const paymentData = (await paymentResponse.json()) as any;

    return {
      success: true,
      transactionId: paymentData.payment?.id || `cashapp_${Date.now()}`,
      provider: "cashapp",
      status: "completed",
    };
  } catch (error) {
    console.error("[CashApp] Payment failed:", error);
    return {
      success: false,
      transactionId: "",
      provider: "cashapp",
      status: "failed",
      error: String(error),
    };
  }
}

/**
 * Venmo Payment Handler
 */
async function handleVenmoPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    const VENMO_ACCESS_TOKEN = process.env.VENMO_ACCESS_TOKEN || "";

    if (!VENMO_ACCESS_TOKEN) {
      console.warn("[Venmo] Access token not configured, using mock mode");
      return {
        success: true,
        transactionId: `venmo_${Date.now()}`,
        provider: "venmo",
        status: "completed",
      };
    }

    // Create Venmo payment
    const paymentResponse = await fetch("https://api.venmo.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VENMO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: `user_${request.userId}`,
        amount: request.amount,
        note: request.description,
        action: "pay",
        audience: "private",
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      throw new Error(`Venmo payment failed: ${errorData.error?.message}`);
    }

    const paymentData = (await paymentResponse.json()) as any;

    return {
      success: true,
      transactionId: paymentData.data?.payment?.id || `venmo_${Date.now()}`,
      provider: "venmo",
      status: "completed",
    };
  } catch (error) {
    console.error("[Venmo] Payment failed:", error);
    return {
      success: false,
      transactionId: "",
      provider: "venmo",
      status: "failed",
      error: String(error),
    };
  }
}

/**
 * Process payment with any provider
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResponse> {
  console.log(`[Payment] Processing ${request.provider} payment: $${request.amount}`);

  switch (request.provider) {
    case "paypal":
      return await handlePayPalPayment(request);
    case "cashapp":
      return await handleCashAppPayment(request);
    case "venmo":
      return await handleVenmoPayment(request);
    default:
      return {
        success: false,
        transactionId: "",
        provider: request.provider,
        status: "failed",
        error: "Unknown payment provider",
      };
  }
}

/**
 * Get available payment providers
 */
export function getAvailableProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [];

  if (process.env.PAYPAL_CLIENT_ID) providers.push("paypal");
  if (process.env.CASHAPP_API_KEY) providers.push("cashapp");
  if (process.env.VENMO_ACCESS_TOKEN) providers.push("venmo");

  // Always include all providers (they have mock mode)
  if (providers.length === 0) {
    return ["paypal", "cashapp", "venmo"];
  }

  return providers;
}

export default {
  processPayment,
  getAvailableProviders,
};
