import { Router, Request, Response } from "express";
import { getUserBankAccount } from "../services/bankService";

const router = Router();

/**
 * POST /api/bank/payment-methods
 * Save a payment method to the user's account
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

    // Validate payment method format
    if (!paymentMethodId.match(/^pm_|^ba_/)) {
      return res.status(400).json({ error: "Invalid payment method ID" });
    }

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

    // Return mock payment methods for now
    res.json({
      success: true,
      paymentMethods: [
        {
          id: "pm_1234567890",
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2025,
        },
      ],
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
