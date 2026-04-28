import { useState } from "react";
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
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
      setError("Please enter a deposit amount");
      return;
    }
    
    if (parseFloat(amount) <= 0) {
      setError("Deposit amount must be greater than 0");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Process deposit on backend
      const res = await fetch("/api/bank/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethodId: "wallet_deposit",
          bankAccountId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAmount("");
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



          <Button
            type="submit"
            disabled={isProcessing || !amount}
            className="w-full bg-magenta-600 hover:bg-magenta-700"
          >
            {isProcessing ? "Processing..." : `Deposit $${amount || "0.00"}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
