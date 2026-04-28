import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

interface NotificationPayload {
  userId: number;
  type: "deposit" | "withdrawal" | "payment" | "refund" | "implant_renewal" | "alert";
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface SMSPayload {
  to: string;
  message: string;
}

/**
 * Send email notification
 */
export async function sendEmailNotification(payload: EmailPayload): Promise<boolean> {
  try {
    // Use Manus built-in email service
    const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/email/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      console.error("[Email] Failed to send:", await response.text());
      return false;
    }

    console.log(`[Email] Sent to ${payload.to}`);
    return true;
  } catch (error) {
    console.error("[Email] Error sending notification:", error);
    return false;
  }
}

/**
 * Send SMS notification
 */
export async function sendSMSNotification(payload: SMSPayload): Promise<boolean> {
  try {
    // Use Manus built-in SMS service
    const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        to: payload.to,
        message: payload.message,
      }),
    });

    if (!response.ok) {
      console.error("[SMS] Failed to send:", await response.text());
      return false;
    }

    console.log(`[SMS] Sent to ${payload.to}`);
    return true;
  } catch (error) {
    console.error("[SMS] Error sending notification:", error);
    return false;
  }
}

/**
 * Send push notification
 */
export async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    // Use Manus built-in notification service
    const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        data: {
          type: payload.type,
          amount: payload.amount,
          currency: payload.currency,
          transactionId: payload.transactionId,
        },
      }),
    });

    if (!response.ok) {
      console.error("[Push] Failed to send:", await response.text());
      return false;
    }

    console.log(`[Push] Sent to user ${payload.userId}`);
    return true;
  } catch (error) {
    console.error("[Push] Error sending notification:", error);
    return false;
  }
}

/**
 * Send transaction receipt
 */
export async function sendTransactionReceipt(
  userId: number,
  transaction: {
    id: number;
    type: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
    description: string;
  }
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) return;

    const userEmail = user[0].email || "";
    const userName = user[0].name || "User";

    const receiptHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Transaction Receipt</h2>
        <p>Dear ${userName},</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> #${transaction.id}</p>
          <p><strong>Type:</strong> ${transaction.type.toUpperCase()}</p>
          <p><strong>Amount:</strong> ${transaction.currency} ${transaction.amount.toFixed(2)}</p>
          <p><strong>Status:</strong> <span style="color: ${transaction.status === "completed" ? "green" : "orange"};">${transaction.status.toUpperCase()}</span></p>
          <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
          <p><strong>Description:</strong> ${transaction.description}</p>
        </div>
        
        <p>If you did not authorize this transaction, please contact support immediately.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Vearch Bank - Immortal Implant Payment OS<br>
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await sendEmailNotification({
      to: userEmail,
      subject: `Transaction Receipt - ${transaction.type.toUpperCase()} ${transaction.currency} ${transaction.amount.toFixed(2)}`,
      html: receiptHtml,
    });

    // Also send push notification
    await sendPushNotification({
      userId,
      type: transaction.type as any,
      title: `${transaction.type.toUpperCase()} Confirmed`,
      message: `${transaction.currency} ${transaction.amount.toFixed(2)} - Transaction ID: #${transaction.id}`,
      amount: transaction.amount,
      currency: transaction.currency,
      transactionId: transaction.id.toString(),
    });
  } catch (error) {
    console.error("[Receipt] Error sending receipt:", error);
  }
}

/**
 * Send implant renewal notification
 */
export async function sendImplantRenewalNotification(userId: number, implantId: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) return;

    const userEmail = user[0].email || "";
    const userName = user[0].name || "User";

    const renewalHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Implant Renewal Completed</h2>
        <p>Dear ${userName},</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Implant ID:</strong> ${implantId}</p>
          <p><strong>Status:</strong> <span style="color: green;">RENEWED</span></p>
          <p><strong>Valid Until:</strong> ${new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toLocaleDateString()}</p>
          <p>Your implant has been automatically renewed for another 5 years. Your tap-to-pay functionality remains active.</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Vearch Bank - Immortal Implant Payment OS<br>
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await sendEmailNotification({
      to: userEmail,
      subject: `Implant Renewal Completed - ${implantId}`,
      html: renewalHtml,
    });

    await sendPushNotification({
      userId,
      type: "implant_renewal",
      title: "Implant Renewed",
      message: `Your implant ${implantId} has been renewed for 5 more years`,
    });
  } catch (error) {
    console.error("[Renewal] Error sending notification:", error);
  }
}

/**
 * Send alert notification
 */
export async function sendAlertNotification(userId: number, alert: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user.length) return;

    const userEmail = user[0].email || "";

    const alertHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Security Alert</h2>
        <p>Dear ${user[0].name || "User"},</p>
        
        <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
          <p>${alert}</p>
        </div>
        
        <p>If you did not authorize this activity, please change your password immediately and contact support.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Vearch Bank - Immortal Implant Payment OS<br>
          This is an automated message. Please do not reply.
        </p>
      </div>
    `;

    await sendEmailNotification({
      to: userEmail,
      subject: "Security Alert - Vearch Bank",
      html: alertHtml,
    });

    await sendPushNotification({
      userId,
      type: "alert",
      title: "Security Alert",
      message: alert,
    });
  } catch (error) {
    console.error("[Alert] Error sending notification:", error);
  }
}

export default {
  sendEmailNotification,
  sendSMSNotification,
  sendPushNotification,
  sendTransactionReceipt,
  sendImplantRenewalNotification,
  sendAlertNotification,
};
