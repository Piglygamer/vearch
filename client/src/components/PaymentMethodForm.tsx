import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check } from "lucide-react";

interface PaymentMethodFormProps {
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: string) => void;
}

export function PaymentMethodForm({ onSuccess, onError }: PaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Stripe not loaded");
      return;
    }

    if (!cardholderName) {
      setError("Please enter cardholder name");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment method from card element
      const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement)!,
        billing_details: {
          name: cardholderName,
        },
      });

      if (createError) {
        setError(createError.message || "Failed to create payment method");
        onError(createError.message || "Failed to create payment method");
        return;
      }

      if (!paymentMethod) {
        setError("Failed to create payment method");
        onError("Failed to create payment method");
        return;
      }

      // Save payment method to backend
      const res = await fetch("/api/bank/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          cardholderName,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setCardholderName("");
        elements.getElement(CardElement)?.clear();
        onSuccess(paymentMethod.id);

        // Reset success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save payment method");
        onError(data.error || "Failed to save payment method");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Payment Method</CardTitle>
        <CardDescription>Add a credit card or debit card to fund your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Payment method added successfully!
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="cardholder">Cardholder Name</Label>
            <Input
              id="cardholder"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="card">Card Details</Label>
            <div className="p-3 border border-border rounded-md bg-background">
              <CardElement
                id="card"
                options={{
                  style: {
                    base: {
                      fontSize: "16px",
                      color: "#424770",
                      "::placeholder": {
                        color: "#aab7c4",
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
            disabled={!stripe || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Adding..." : "Add Payment Method"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
