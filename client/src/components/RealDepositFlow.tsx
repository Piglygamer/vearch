/**
 * REAL Deposit Flow
 * 
 * This is NOT simulated. It:
 * 1. Collects real card details via Stripe Elements
 * 2. Processes real Stripe charges
 * 3. Generates real Stripe virtual cards
 * 4. Funds wallet with real money
 */

import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface RealDepositFlowProps {
  userId: number;
  onSuccess: (transactionId: string, amount: number) => void;
  onError: (error: string) => void;
}

export function RealDepositFlow({
  userId,
  onSuccess,
  onError,
}: RealDepositFlowProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Real tRPC mutation for processing deposit
  const processDeposit = trpc.deposit.processRealDeposit.useMutation();

  /**
   * Handle real deposit with actual card
   */
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Stripe not loaded");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const amountInCents = Math.round(parseFloat(amount) * 100);

      // 1. Create payment method from card details
      const { error: methodError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: "card",
              card: elements.getElement(CardElement) as any,
        });

      if (methodError) {
        throw new Error(methodError.message);
      }

      // 2. Call backend to process real Stripe charge
      const result = await processDeposit.mutateAsync({
        userId,
        amount: amountInCents,
        paymentMethodId: paymentMethod.id || "",
        currency: "usd",
      });

      if (result.success) {
        setSuccess(
          `✓ Deposited $${amount}. Virtual card created: ${result.virtualCardId}`
        );
        onSuccess(result.transactionId || "", parseFloat(amount));

        // Clear form
        setAmount("100");
        elements.getElement(CardElement)?.clear();
      } else {
        throw new Error(result.error || "Deposit failed");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Deposit failed";
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/30">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Add Money</h3>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-200 text-sm">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleDeposit} className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount (USD)
            </label>
            <div className="flex gap-2">
              <span className="text-white font-semibold pt-2">$</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                disabled={loading}
              />
            </div>
          </div>

          {/* Card Input - REAL Stripe card collection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Card Details
            </label>
            <div className="p-3 bg-slate-700 border border-slate-600 rounded">
              <CardElement
                options={{
                  style: {
                    base: {
                      color: "#fff",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      fontSize: "14px",
                      "::placeholder": {
                        color: "#9ca3af",
                      },
                    },
                    invalid: {
                      color: "#ef4444",
                    },
                  },
                }}
              />
            </div>
            <p className="text-slate-400 text-xs mt-2">
              Test card: 4242 4242 4242 4242 | Any future date | Any CVC
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!stripe || loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Deposit $${amount}`
            )}
          </Button>
        </form>

        {/* Info */}
        <div className="p-3 bg-slate-700/50 rounded text-slate-300 text-xs">
          <p className="font-medium mb-2">What happens:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Real charge on your card via Stripe</li>
            <li>Virtual Stripe card generated</li>
            <li>Funds added to your Vearch wallet</li>
            <li>Card linked to your NFC implant</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
