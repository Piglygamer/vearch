import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Bitcoin,
  Building2,
  Globe,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type PaymentMethod = "crypto" | "ach" | "wire";

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  balance: number;
}

const METHODS: {
  id: PaymentMethod;
  name: string;
  desc: string;
  time: string;
  icon: typeof Bitcoin;
}[] = [
  {
    id: "crypto",
    name: "Cryptocurrency",
    desc: "Send to any wallet address",
    time: "10-30 min",
    icon: Bitcoin,
  },
  {
    id: "ach",
    name: "ACH Transfer",
    desc: "US bank account",
    time: "2-3 business days",
    icon: Building2,
  },
  {
    id: "wire",
    name: "Wire Transfer",
    desc: "Domestic / international",
    time: "Same day",
    icon: Globe,
  },
];

export function WithdrawalModal({
  open,
  onOpenChange,
  onSuccess,
  balance,
}: WithdrawalModalProps) {
  const [step, setStep] = useState<"method" | "details" | "success">("method");
  const [method, setMethod] = useState<PaymentMethod>("crypto");
  const [amount, setAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationBank, setDestinationBank] = useState({
    accountNumber: "",
    routingNumber: "",
    bankName: "",
    accountType: "checking" as "checking" | "savings",
    accountHolder: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const withdrawMutation = trpc.bank.withdraw.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("success");
      onSuccess();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amt > balance) {
      setError(`Insufficient balance. Available: $${balance.toFixed(2)}`);
      return;
    }
    if (method === "crypto" && !destinationAddress.trim()) {
      setError("Enter a destination wallet address");
      return;
    }

    withdrawMutation.mutate({
      amount: amt,
      method,
      destinationAddress: method === "crypto" ? destinationAddress : undefined,
      destinationBank: method !== "crypto" ? destinationBank : undefined,
    });
  };

  const reset = () => {
    setStep("method");
    setAmount("");
    setDestinationAddress("");
    setError(null);
    setResult(null);
    setDestinationBank({
      accountNumber: "",
      routingNumber: "",
      bankName: "",
      accountType: "checking",
      accountHolder: "",
    });
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {step === "method"
              ? "Withdraw Funds"
              : step === "details"
                ? `Withdraw via ${METHODS.find((m) => m.id === method)?.name}`
                : "Withdrawal Initiated"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "method"
              ? "Choose where to send your funds"
              : step === "details"
                ? "Enter the withdrawal details"
                : "Your withdrawal is being processed"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {/* Balance display */}
        {step !== "success" && (
          <div className="bg-background rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-xl font-bold text-neon-green font-[JetBrains_Mono]">
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* Step 1: Method selection */}
        {step === "method" && (
          <div className="space-y-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMethod(m.id);
                  setStep("details");
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border transition-all text-left hover:border-cyan/40 hover:bg-accent/50"
              >
                <div className="h-10 w-10 rounded-lg bg-cyan/10 flex items-center justify-center shrink-0">
                  <m.icon className="h-5 w-5 text-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{m.time}</p>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw-amount">Amount (USD)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.01"
                min="1"
                max={balance}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={withdrawMutation.isPending}
                className="mt-1 font-mono text-lg"
                autoFocus
              />
            </div>

            {method === "crypto" && (
              <div>
                <Label htmlFor="dest-address">Destination Wallet Address</Label>
                <Input
                  id="dest-address"
                  placeholder="0x... or bc1... or ..."
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  disabled={withdrawMutation.isPending}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            )}

            {(method === "ach" || method === "wire") && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="w-account-holder">Account Holder</Label>
                  <Input
                    id="w-account-holder"
                    placeholder="John Doe"
                    value={destinationBank.accountHolder}
                    onChange={(e) =>
                      setDestinationBank({ ...destinationBank, accountHolder: e.target.value })
                    }
                    disabled={withdrawMutation.isPending}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="w-routing">Routing Number</Label>
                    <Input
                      id="w-routing"
                      placeholder="021000021"
                      value={destinationBank.routingNumber}
                      onChange={(e) =>
                        setDestinationBank({ ...destinationBank, routingNumber: e.target.value })
                      }
                      disabled={withdrawMutation.isPending}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="w-account">Account Number</Label>
                    <Input
                      id="w-account"
                      placeholder="123456789"
                      value={destinationBank.accountNumber}
                      onChange={(e) =>
                        setDestinationBank({ ...destinationBank, accountNumber: e.target.value })
                      }
                      disabled={withdrawMutation.isPending}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="w-bank-name">Bank Name</Label>
                    <Input
                      id="w-bank-name"
                      placeholder="Chase"
                      value={destinationBank.bankName}
                      onChange={(e) =>
                        setDestinationBank({ ...destinationBank, bankName: e.target.value })
                      }
                      disabled={withdrawMutation.isPending}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="w-account-type">Account Type</Label>
                    <select
                      id="w-account-type"
                      value={destinationBank.accountType}
                      onChange={(e) =>
                        setDestinationBank({
                          ...destinationBank,
                          accountType: e.target.value as "checking" | "savings",
                        })
                      }
                      disabled={withdrawMutation.isPending}
                      className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-input text-foreground text-sm"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("method")}
                disabled={withdrawMutation.isPending}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={withdrawMutation.isPending || !amount}
                className="flex-1 bg-cyan hover:bg-cyan-dark text-white"
              >
                {withdrawMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Withdraw $${amount || "0.00"}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === "success" && result && (
          <div className="text-center py-4 space-y-4">
            <div className="h-16 w-16 rounded-full bg-cyan/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-cyan" />
            </div>
            <div>
              <p className="text-2xl font-bold font-[JetBrains_Mono] text-cyan">
                -${result.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            </div>
            {result.estimatedCompletion && (
              <p className="text-xs text-muted-foreground">
                Estimated: {result.estimatedCompletion}
              </p>
            )}
            <Button
              onClick={() => handleClose(false)}
              className="w-full bg-cyan hover:bg-cyan-dark text-white"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
