import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  balance: number;
}

const PAYMENT_PROVIDERS = [
  { id: "paypal", name: "PayPal", icon: "💳" },
  { id: "cashapp", name: "Cash App", icon: "💵" },
  { id: "venmo", name: "Venmo", icon: "📱" },
];

export function WithdrawalModal({ open, onOpenChange, onSuccess, balance }: WithdrawalModalProps) {
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("paypal");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
      setError("Please enter a withdrawal amount");
      return;
    }
    
    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) {
      setError("Withdrawal amount must be greater than 0");
      return;
    }

    if (withdrawAmount > balance) {
      setError(`Insufficient balance. Available: $${balance.toFixed(2)}`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Process withdrawal on backend
      const res = await fetch("/api/bank/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: withdrawAmount,
          provider,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAmount("");
        onOpenChange(false);
        onSuccess();
      } else {
        setError(data.error || "Withdrawal failed");
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
          <DialogTitle>Withdraw Money</DialogTitle>
          <DialogDescription>
            Withdraw funds from your Vearch Bank account to your bank account
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <div className="bg-background/50 border border-border rounded-md p-3 mb-4">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold text-cyan-400">${balance.toFixed(2)}</p>
        </div>

        <form onSubmit={handleWithdrawal} className="space-y-4">
          <div>
            <Label htmlFor="withdrawal-amount">Amount (USD)</Label>
            <Input
              id="withdrawal-amount"
              type="number"
              step="0.01"
              min="1"
              max={balance}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div>
            <Label htmlFor="provider">Payment Method</Label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={isProcessing}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              {PAYMENT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={isProcessing || !amount}
            className="w-full bg-cyan-600 hover:bg-cyan-700"
          >
            {isProcessing ? "Processing..." : `Withdraw $${amount || "0.00"}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
