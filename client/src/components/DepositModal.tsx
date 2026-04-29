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
type CryptoCurrency = "BTC" | "ETH" | "SOL" | "USDC" | "USDT";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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
    desc: "BTC, ETH, SOL, USDC, USDT",
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

const CRYPTO_CURRENCIES: { id: CryptoCurrency; name: string }[] = [
  { id: "BTC", name: "Bitcoin" },
  { id: "ETH", name: "Ethereum" },
  { id: "SOL", name: "Solana" },
  { id: "USDC", name: "USD Coin" },
  { id: "USDT", name: "Tether" },
];

export function DepositModal({ open, onOpenChange, onSuccess }: DepositModalProps) {
  const [step, setStep] = useState<"method" | "details" | "success">("method");
  const [method, setMethod] = useState<PaymentMethod>("crypto");
  const [amount, setAmount] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>("BTC");
  const [bankAccount, setBankAccount] = useState({
    accountNumber: "",
    routingNumber: "",
    bankName: "",
    accountType: "checking" as "checking" | "savings",
    accountHolder: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const depositMutation = trpc.bank.deposit.useMutation({
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

    depositMutation.mutate({
      amount: amt,
      method,
      cryptoCurrency: method === "crypto" ? cryptoCurrency : undefined,
      bankAccount: method !== "crypto" ? bankAccount : undefined,
    });
  };

  const reset = () => {
    setStep("method");
    setAmount("");
    setError(null);
    setResult(null);
    setBankAccount({
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
              ? "Deposit Funds"
              : step === "details"
                ? `Deposit via ${METHODS.find((m) => m.id === method)?.name}`
                : "Deposit Initiated"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "method"
              ? "Choose a payment method to add funds"
              : step === "details"
                ? "Enter the deposit details"
                : "Your deposit is being processed"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
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
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border transition-all text-left hover:border-primary/40 hover:bg-accent/50"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <m.icon className="h-5 w-5 text-primary" />
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
              <Label htmlFor="deposit-amount">Amount (USD)</Label>
              <Input
                id="deposit-amount"
                type="number"
                step="0.01"
                min="1"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={depositMutation.isPending}
                className="mt-1 font-mono text-lg"
                autoFocus
              />
            </div>

            {method === "crypto" && (
              <div>
                <Label>Cryptocurrency</Label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {CRYPTO_CURRENCIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCryptoCurrency(c.id)}
                      className={`py-2 px-1 rounded-lg border text-center text-xs font-medium transition-all ${
                        cryptoCurrency === c.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {c.id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(method === "ach" || method === "wire") && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="account-holder">Account Holder</Label>
                  <Input
                    id="account-holder"
                    placeholder="John Doe"
                    value={bankAccount.accountHolder}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, accountHolder: e.target.value })
                    }
                    disabled={depositMutation.isPending}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="routing-number">Routing Number</Label>
                    <Input
                      id="routing-number"
                      placeholder="021000021"
                      value={bankAccount.routingNumber}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, routingNumber: e.target.value })
                      }
                      disabled={depositMutation.isPending}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input
                      id="account-number"
                      placeholder="123456789"
                      value={bankAccount.accountNumber}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, accountNumber: e.target.value })
                      }
                      disabled={depositMutation.isPending}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input
                      id="bank-name"
                      placeholder="Chase"
                      value={bankAccount.bankName}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, bankName: e.target.value })
                      }
                      disabled={depositMutation.isPending}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-type">Account Type</Label>
                    <select
                      id="account-type"
                      value={bankAccount.accountType}
                      onChange={(e) =>
                        setBankAccount({
                          ...bankAccount,
                          accountType: e.target.value as "checking" | "savings",
                        })
                      }
                      disabled={depositMutation.isPending}
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
                disabled={depositMutation.isPending}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={depositMutation.isPending || !amount}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {depositMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Deposit $${amount || "0.00"}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === "success" && result && (
          <div className="text-center py-4 space-y-4">
            <div className="h-16 w-16 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-neon-green" />
            </div>
            <div>
              <p className="text-2xl font-bold font-[JetBrains_Mono] text-neon-green">
                +${result.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
            </div>
            {result.estimatedCompletion && (
              <p className="text-xs text-muted-foreground">
                Estimated: {result.estimatedCompletion}
              </p>
            )}
            {result.details?.depositAddress && (
              <div className="bg-background rounded-lg p-3 text-left">
                <p className="text-xs text-muted-foreground mb-1">Send to address:</p>
                <p className="text-xs font-mono text-foreground break-all">
                  {result.details.depositAddress as string}
                </p>
              </div>
            )}
            <Button
              onClick={() => handleClose(false)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
