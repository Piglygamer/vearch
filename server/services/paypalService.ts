/**
 * PayPal Service: Handles real payment processing, deposits, and withdrawals
 * Replaces Stripe for all payment operations
 */

const PAYPAL_API_URL = process.env.PAYPAL_API_URL || "https://api.sandbox.paypal.com";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";

let paypalAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get PayPal access token
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (paypalAccessToken && Date.now() < tokenExpiresAt) {
    return paypalAccessToken;
  }

  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

    const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    paypalAccessToken = data.access_token || null;
    if (!paypalAccessToken) throw new Error("No access token in response");
    tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // Refresh 60s before expiry

    console.log("[PayPal] Access token obtained successfully");
    return paypalAccessToken;
  } catch (error) {
    console.error("[PayPal] Failed to get access token:", error);
    throw error;
  }
}

/**
 * Create a payment (deposit)
 */
export async function createPayment(
  userId: number,
  amount: number,
  currency: string = "USD",
  returnUrl: string = "https://vearch.bank/deposit/success",
  cancelUrl: string = "https://vearch.bank/deposit/cancel"
): Promise<{
  paymentId: string;
  approvalUrl: string;
  status: string;
}> {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials not configured");
    }

    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v1/payments/payment`, {
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
              total: amount.toFixed(2),
              currency,
              details: {
                subtotal: amount.toFixed(2),
              },
            },
            description: `Vearch Bank Deposit - User ${userId}`,
            custom: userId.toString(),
          },
        ],
        redirect_urls: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`PayPal payment creation failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    // Find approval URL
    const approvalLink = data.links?.find((link: any) => link.rel === "approval_url");

    return {
      paymentId: data.id,
      approvalUrl: approvalLink?.href || "",
      status: data.state,
    };
  } catch (error) {
    console.error("[PayPal] Payment creation failed:", error);
    throw error;
  }
}

/**
 * Execute a payment (after user approval)
 */
export async function executePayment(
  paymentId: string,
  payerId: string
): Promise<{
  success: boolean;
  transactionId: string;
  status: string;
  amount: number;
}> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v1/payments/payment/${paymentId}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payer_id: payerId,
      }),
    });

    if (!response.ok) {
      throw new Error(`PayPal payment execution failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    const transaction = data.transactions?.[0]?.related_resources?.[0]?.sale;

    return {
      success: data.state === "approved",
      transactionId: transaction?.id || "",
      status: data.state,
      amount: parseFloat(data.transactions?.[0]?.amount?.total || "0"),
    };
  } catch (error) {
    console.error("[PayPal] Payment execution failed:", error);
    throw error;
  }
}

/**
 * Create a payout (withdrawal)
 */
export async function createPayout(
  recipientEmail: string,
  amount: number,
  currency: string = "USD",
  note: string = "Vearch Bank Withdrawal"
): Promise<{
  batchId: string;
  status: string;
  payoutItemId: string;
}> {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials not configured");
    }

    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `batch_${Date.now()}`,
          email_subject: "Vearch Bank Withdrawal",
          email_message: note,
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              value: amount.toFixed(2),
              currency,
            },
            description: note,
            receiver: recipientEmail,
            note: note,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`PayPal payout creation failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    return {
      batchId: data.batch_header?.payout_batch_id || "",
      status: data.batch_header?.batch_status || "PENDING",
      payoutItemId: data.items?.[0]?.payout_item_id || "",
    };
  } catch (error) {
    console.error("[PayPal] Payout creation failed:", error);
    throw error;
  }
}

/**
 * Get payment details
 */
export async function getPaymentDetails(paymentId: string): Promise<any> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v1/payments/payment/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal get payment failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[PayPal] Get payment failed:", error);
    throw error;
  }
}

/**
 * Get payout details
 */
export async function getPayoutDetails(batchId: string): Promise<any> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v1/payments/payouts/${batchId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal get payout failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[PayPal] Get payout failed:", error);
    throw error;
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(
  saleId: string,
  amount?: number,
  currency: string = "USD"
): Promise<{
  success: boolean;
  refundId: string;
  status: string;
}> {
  try {
    const accessToken = await getAccessToken();

    const body: any = {};
    if (amount) {
      body.amount = {
        total: amount.toFixed(2),
        currency,
      };
    }

    const response = await fetch(`${PAYPAL_API_URL}/v1/payments/sale/${saleId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`PayPal refund failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    return {
      success: data.state === "completed",
      refundId: data.id || "",
      status: data.state,
    };
  } catch (error) {
    console.error("[PayPal] Refund failed:", error);
    throw error;
  }
}

export default {
  getAccessToken,
  createPayment,
  executePayment,
  createPayout,
  getPaymentDetails,
  getPayoutDetails,
  refundPayment,
};
