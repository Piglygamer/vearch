import { Router, Request, Response } from "express";
import { getUserBankAccount } from "../services/bankService";
import { getStripeClient } from "../services/stripeService";

const router = Router();

/**
 * POST /api/bank/payment-methods
 * Save a payment method to the user's Stripe account
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { paymentMethodId, cardholderName } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: "Missing paymentMethodId" });
    }

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.status(400).json({ error: "Bank account not found. Create one first." });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not initialized" });
    }

    // Attach payment method to the Stripe account
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: account.stripeAccountId,
    });

    // Set as default payment method
    await stripe.customers.update(account.stripeAccountId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({
      success: true,
      paymentMethodId,
      message: "Payment method added successfully",
    });
  } catch (error) {
    console.error("[Payment Methods API] Failed to save payment method:", error);
    res.status(500).json({ error: "Failed to save payment method" });
  }
});

/**
 * GET /api/bank/payment-methods
 * Get all payment methods for the user
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.json({
        success: true,
        paymentMethods: [],
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.json({
        success: true,
        paymentMethods: [],
      });
    }

    // Get all payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: account.stripeAccountId,
      type: "card",
    });

    res.json({
      success: true,
      paymentMethods: paymentMethods.data.map((pm: any) => ({
        id: pm.id,
        brand: (pm.card as any)?.brand,
        last4: (pm.card as any)?.last4,
        expMonth: (pm.card as any)?.exp_month,
        expYear: (pm.card as any)?.exp_year,
      })),
    });
  } catch (error) {
    console.error("[Payment Methods API] Failed to get payment methods:", error);
    res.status(500).json({ error: "Failed to get payment methods" });
  }
});

/**
 * DELETE /api/bank/payment-methods/:paymentMethodId
 * Delete a payment method
 */
router.delete("/:paymentMethodId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { paymentMethodId } = req.params;

    if (!paymentMethodId) {
      return res.status(400).json({ error: "Missing paymentMethodId" });
    }

    const account = await getUserBankAccount(userId);
    if (!account) {
      return res.status(400).json({ error: "Bank account not found" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not initialized" });
    }

    // Detach payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({
      success: true,
      message: "Payment method deleted",
    });
  } catch (error) {
    console.error("[Payment Methods API] Failed to delete payment method:", error);
    res.status(500).json({ error: "Failed to delete payment method" });
  }
});

export default router;
