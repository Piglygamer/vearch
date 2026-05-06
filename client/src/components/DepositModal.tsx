import { useState, useEffect } from "react";
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
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Bitcoin,
  Building2,
  Globe,
  Copy,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

type DepositStep = "method" | "crypto-address" | "bank-link" | "bank-amount" | "success";
type DepositMethod = "crypto-bitcoin" | "crypto-ethereum" | "bank-ach" | "bank-wire";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DepositModal({ open, onOpenChange, onSuccess }: DepositModalProps) {
  const [step, setStep] = useState<DepositStep>("method");
  const [method, setMethod] = useState<DepositMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crypto state
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState<"bitcoin" | "ethereum">("bitcoin");

  // Bank state
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [bankName, setBankName] = useState("");
  const [transferId, setTransferId] = useState("");

  // tRPC mutations
  const generateBitcoin = trpc.payment.crypto.generateBitcoinAddress.useMutation();
  const generateEthereum = trpc.payment.crypto.generateEthereumAddress.useMutation();
  const getBitcoinBalance = trpc.payment.crypto.getBalance.useQuery(
    { network: "bitcoin" },
    { enabled: step === "crypto-address" && cryptoNetwork === "bitcoin", refetchInterval: 5000 }
  );
  const getEthereumBalance = trpc.payment.crypto.getBalance.useQuery(
    { network: "ethereum" },
    { enabled: step === "crypto-address" && cryptoNetwork === "ethereum", refetchInterval: 5000 }
  );

  const generatePlaidLink = trpc.payment.banking.generatePlaidLink.useMutation();
  const exchangePlaidToken = trpc.payment.banking.exchangePlaidToken.useMutation();
  const initiateACHDeposit = trpc.payment.banking.initiateACHDeposit.useMutation();
  const getLinkedAccounts = trpc.payment.banking.getLinkedAccounts.useQuery(
    undefined,
    { enabled: step === "bank-link" }
  );

  // Step 1: Select method
  const handleSelectMethod = async (selectedMethod: DepositMethod) => {
    setError(null);
    setMethod(selectedMethod);

    if (selectedMethod === "crypto-bitcoin") {
      try {
        const result = await generateBitcoin.mutateAsync();
        setCryptoAddress(result.address);
        setCryptoNetwork("bitcoin");
        setStep("crypto-address");
      } catch (err) {
        setError("Failed to generate Bitcoin address");
      }
    } else if (selectedMethod === "crypto-ethereum") {
      try {
        const result = await generateEthereum.mutateAsync();
        setCryptoAddress(result.address);
        setCryptoNetwork("ethereum");
        setStep("crypto-address");
      } catch (err) {
        setError("Failed to generate Ethereum address");
      }
    } else if (selectedMethod === "bank-ach" || selectedMethod === "bank-wire") {
      try {
        await generatePlaidLink.mutateAsync();
        setStep("bank-link");
      } catch (err) {
        setError("Failed to initialize bank linking");
      }
    }
  };

  // Copy address to clipboard
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(cryptoAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Link bank account (simulated Plaid)
  const handleLinkBank = async () => {
    try {
      const result = await exchangePlaidToken.mutateAsync({
        publicToken: `public_token_${Date.now()}`,
      });
      setLinkedAccountId(result.accountId);
      setBankName(result.bankName);
      setStep("bank-amount");
    } catch (err) {
      setError("Failed to link bank account");
    }
  };

  // Initiate ACH deposit
  const handleInitiateACH = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    try {
      const result = await initiateACHDeposit.mutateAsync({
        accountId: linkedAccountId,
        amount,
      });
      setTransferId(result.transferId);
      setStep("success");
      onSuccess();
    } catch (err) {
      setError("Failed to initiate ACH deposit");
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setStep("method");
      setMethod(null);
      setAmount("");
      setError(null);
      setCryptoAddress("");
      setLinkedAccountId("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {step === "method"
              ? "Deposit Funds"
              : step === "crypto-address"
                ? "Bitcoin Testnet Deposit"
                : step === "bank-link"
                  ? "Link Bank Account"
                  : step === "bank-amount"
                    ? "ACH Deposit Amount"
                    : "Deposit Initiated"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "method"
              ? "Choose how you want to deposit funds"
              : step === "crypto-address"
                ? "Send testnet BTC to this address"
                : step === "bank-link"
                  ? "Connect your bank account"
                  : step === "bank-amount"
                    ? "Enter deposit amount"
                    : "Your deposit is being processed"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {/* Method Selection */}
        {step === "method" && (
          <div className="space-y-2">
            <Card
              className="p-4 cursor-pointer border-border hover:bg-accent/50 transition"
              onClick={() => handleSelectMethod("crypto-bitcoin")}
            >
              <div className="flex items-center gap-3">
                <Bitcoin className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">Bitcoin Testnet</p>
                  <p className="text-sm text-muted-foreground">Instant deposit</p>
                </div>
                <span className="text-xs text-muted-foreground">10-30 min</span>
              </div>
            </Card>

            <Card
              className="p-4 cursor-pointer border-border hover:bg-accent/50 transition"
              onClick={() => handleSelectMethod("crypto-ethereum")}
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">Ethereum Sepolia</p>
                  <p className="text-sm text-muted-foreground">Instant deposit</p>
                </div>
                <span className="text-xs text-muted-foreground">10-30 min</span>
              </div>
            </Card>

            <Card
              className="p-4 cursor-pointer border-border hover:bg-accent/50 transition"
              onClick={() => handleSelectMethod("bank-ach")}
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">ACH Transfer</p>
                  <p className="text-sm text-muted-foreground">Link your bank account</p>
                </div>
                <span className="text-xs text-muted-foreground">2-3 days</span>
              </div>
            </Card>
          </div>
        )}

        {/* Crypto Address Display */}
        {step === "crypto-address" && (
          <div className="space-y-4">
            <div className="bg-background rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Send {cryptoNetwork === "bitcoin" ? "testnet BTC" : "testnet ETH"} to:</p>
              <p className="font-mono text-sm break-all mb-3">{cryptoAddress}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleCopyAddress}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </>
                )}
              </Button>
            </div>

            <div className="bg-accent/20 border border-accent/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Current Balance</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cryptoNetwork === "bitcoin"
                      ? getBitcoinBalance.data?.balance || "0"
                      : getEthereumBalance.data?.balance || "0"}{" "}
                    {cryptoNetwork === "bitcoin" ? "BTC" : "ETH"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (cryptoNetwork === "bitcoin") {
                      getBitcoinBalance.refetch();
                    } else {
                      getEthereumBalance.refetch();
                    }
                  }}
                  disabled={getBitcoinBalance.isLoading || getEthereumBalance.isLoading}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Bank Link */}
        {step === "bank-link" && (
          <div className="space-y-4">
            <Alert className="border-accent/50 bg-accent/10">
              <AlertCircle className="h-4 w-4 text-accent" />
              <AlertDescription className="text-accent">
                In production, this opens Plaid Link to connect your real bank account securely.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleLinkBank}
              disabled={exchangePlaidToken.isPending}
              className="w-full"
            >
              {exchangePlaidToken.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                "Link Bank Account (Simulated)"
              )}
            </Button>
          </div>
        )}

        {/* Bank Amount */}
        {step === "bank-amount" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 font-mono text-lg"
                autoFocus
              />
            </div>

            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-sm">
                <strong>Bank:</strong> {bankName} ****1234
              </p>
              <p className="text-sm mt-2">
                <strong>Timeline:</strong> 2-3 business days
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("bank-link")}
                disabled={initiateACHDeposit.isPending}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleInitiateACH}
                disabled={initiateACHDeposit.isPending || !amount}
                className="flex-1"
              >
                {initiateACHDeposit.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Deposit $${amount || "0.00"}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="text-center py-4 space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">+${amount}</p>
              <p className="text-sm text-muted-foreground mt-1">Deposit initiated successfully</p>
              <p className="text-xs text-muted-foreground mt-2">Transfer ID: {transferId.slice(0, 12)}...</p>
            </div>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
