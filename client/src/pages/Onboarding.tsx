import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Zap } from "lucide-react";

type OnboardingStep = "welcome" | "wallet" | "payment" | "implant" | "complete";

export function Onboarding() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Wallet setup state
  const [walletType, setWalletType] = useState("prepaid");

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState("bank_account");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Implant state
  const [implantId, setImplantId] = useState("");
  const [implantType, setImplantType] = useState("apex_flex");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  const handleCreateWallet = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/wallets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletType }),
      });

      const data = await res.json();
      if (data.success) {
        setStep("payment");
      } else {
        setError(data.error || "Failed to create wallet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLinkPaymentMethod = async () => {
    if (!bankName || !accountNumber) {
      setError("Please fill in all fields");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/payment-methods/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          bankName,
          accountNumber,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStep("implant");
      } else {
        setError(data.error || "Failed to link payment method");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLinkImplant = async () => {
    if (!implantId) {
      setError("Please enter an implant ID");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/implants/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          implantId,
          implantType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStep("complete");
      } else {
        setError(data.error || "Failed to link implant");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipImplant = () => {
    setStep("complete");
  };

  const handleComplete = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 ${step === "welcome" || step === "wallet" || step === "payment" || step === "implant" || step === "complete" ? "text-primary" : "text-muted-foreground"}`}>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
              <span className="text-sm font-medium">Wallet</span>
            </div>
            <div className={`flex items-center gap-2 ${step === "payment" || step === "implant" || step === "complete" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full ${step === "payment" || step === "implant" || step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} flex items-center justify-center text-sm font-bold`}>2</div>
              <span className="text-sm font-medium">Payment</span>
            </div>
            <div className={`flex items-center gap-2 ${step === "implant" || step === "complete" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full ${step === "implant" || step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} flex items-center justify-center text-sm font-bold`}>3</div>
              <span className="text-sm font-medium">Implant</span>
            </div>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width:
                  step === "welcome"
                    ? "0%"
                    : step === "wallet"
                      ? "33%"
                      : step === "payment"
                        ? "66%"
                        : step === "implant"
                          ? "100%"
                          : "100%",
              }}
            />
          </div>
        </div>

        {/* Welcome Step */}
        {step === "welcome" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                Welcome to Vearch Bank
              </CardTitle>
              <CardDescription>Let's set up your account in 3 easy steps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">Create Your Wallet</h3>
                    <p className="text-sm text-muted-foreground">Set up a prepaid wallet to hold your funds</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">Link Payment Method</h3>
                    <p className="text-sm text-muted-foreground">Connect your bank account for deposits and withdrawals</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">Link Your Implant (Optional)</h3>
                    <p className="text-sm text-muted-foreground">Enable tap-to-pay with your Apex Flex implant</p>
                  </div>
                </div>
              </div>

              <Button onClick={() => setStep("wallet")} className="w-full bg-primary hover:bg-primary/90">
                Get Started
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Wallet Step */}
        {step === "wallet" && (
          <Card>
            <CardHeader>
              <CardTitle>Create Your Wallet</CardTitle>
              <CardDescription>Choose your wallet type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert className="border-red-500/50 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label>Wallet Type</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted" onClick={() => setWalletType("prepaid")}>
                    <input type="radio" name="walletType" value="prepaid" checked={walletType === "prepaid"} onChange={(e) => setWalletType(e.target.value)} />
                    <div>
                      <p className="font-medium">Prepaid Wallet</p>
                      <p className="text-sm text-muted-foreground">Load funds and use them for transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted" onClick={() => setWalletType("bank_account")}>
                    <input type="radio" name="walletType" value="bank_account" checked={walletType === "bank_account"} onChange={(e) => setWalletType(e.target.value)} />
                    <div>
                      <p className="font-medium">Bank Account</p>
                      <p className="text-sm text-muted-foreground">Direct access to your bank account</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("welcome")} disabled={isProcessing} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleCreateWallet} disabled={isProcessing} className="flex-1 bg-primary hover:bg-primary/90">
                  {isProcessing ? "Creating..." : "Create Wallet"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Method Step */}
        {step === "payment" && (
          <Card>
            <CardHeader>
              <CardTitle>Link Payment Method</CardTitle>
              <CardDescription>Add a way to fund your wallet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert className="border-red-500/50 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label>Payment Method Type</Label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background">
                  <option value="bank_account">Bank Account</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                </select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input id="bank-name" placeholder="e.g., TD Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={isProcessing} />
              </div>

              <div className="space-y-3">
                <Label htmlFor="account-number">Account Number</Label>
                <Input id="account-number" placeholder="••••••••1234" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} disabled={isProcessing} type="password" />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("wallet")} disabled={isProcessing} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleLinkPaymentMethod} disabled={isProcessing} className="flex-1 bg-primary hover:bg-primary/90">
                  {isProcessing ? "Linking..." : "Link Payment Method"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Implant Step */}
        {step === "implant" && (
          <Card>
            <CardHeader>
              <CardTitle>Link Your Implant (Optional)</CardTitle>
              <CardDescription>Enable tap-to-pay transactions with your Apex Flex implant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert className="border-red-500/50 bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label htmlFor="implant-id">Implant ID</Label>
                <Input id="implant-id" placeholder="Scan or enter your implant ID" value={implantId} onChange={(e) => setImplantId(e.target.value)} disabled={isProcessing} />
              </div>

              <div className="space-y-3">
                <Label>Implant Type</Label>
                <select value={implantType} onChange={(e) => setImplantType(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background" disabled={isProcessing}>
                  <option value="apex_flex">Apex Flex</option>
                  <option value="vivokey">VivoKey</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("payment")} disabled={isProcessing} className="flex-1">
                  Back
                </Button>
                <Button variant="outline" onClick={handleSkipImplant} disabled={isProcessing} className="flex-1">
                  Skip
                </Button>
                <Button onClick={handleLinkImplant} disabled={isProcessing} className="flex-1 bg-primary hover:bg-primary/90">
                  {isProcessing ? "Linking..." : "Link Implant"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                Account Setup Complete!
              </CardTitle>
              <CardDescription>Your Vearch Bank account is ready to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Wallet created and ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Payment method linked</span>
                </div>
                {implantId && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Implant linked for tap-to-pay</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>You can now:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Deposit funds into your wallet</li>
                  <li>Make transactions</li>
                  {implantId && <li>Use tap-to-pay with your implant</li>}
                  <li>Withdraw funds to your bank account</li>
                </ul>
              </div>

              <Button onClick={handleComplete} className="w-full bg-primary hover:bg-primary/90">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
