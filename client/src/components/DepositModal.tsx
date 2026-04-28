import { useState } from "react";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  bankAccountId?: string;
}

export function DepositModal({ open, onOpenChange, onSuccess, bankAccountId }: DepositModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !amount || !bankAccountId) {
      setError("Please fill in all fields");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card element not found");
        setIsProcessing(false);
        return;
      }

      // Create payment method from card
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (pmError) {
        setError(pmError.message || "Failed to create payment method");
        setIsProcessing(false);
        return;
      }

      // Process deposit on backend
      const res = await fetch("/api/bank/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethodId: paymentMethod.id,
          bankAccountId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAmount("");
        cardElement.clear();
        onOpenChange(false);
        onSuccess();
      } else {
        setError(data.error || "Deposit failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deposit Money</DialogTitle>
          <DialogDescription>
            Add funds to your Vearch Bank account using your credit or debit card
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleDeposit} className="space-y-4">
          <div>
            <Label htmlFor="deposit-amount">Amount (USD)</Label>
            <Input
              id="deposit-amount"
              type="number"
              step="0.01"
              min="1"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div>
            <Label htmlFor="card-element">Card Details</Label>
            <div className="border border-border rounded-md p-3 bg-card">
              <CardElement
                id="card-element"
                options={{
                  style: {
                    base: {
                      fontSize: "16px",
                      color: "#fff",
                      "::placeholder": {
                        color: "#666",
                      },
                    },
                    invalid: {
                      color: "#fa755a",
                    },
                  },
                }}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isProcessing || !stripe || !amount}
            className="w-full bg-magenta-600 hover:bg-magenta-700"
          >
            {isProcessing ? "Processing..." : `Deposit $${amount || "0.00"}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
