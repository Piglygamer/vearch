import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Zap, CreditCard, Wallet, TrendingUp, RefreshCw, Plus, Send, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DepositModal } from "@/components/DepositModal";

export default function Dashboard() {
  const [implants, setImplants] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccount, setBankAccount] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showBankModal, setShowBankModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  // Form states
  const [bankEmail, setBankEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);

      const [implantsRes, cardsRes, walletsRes, transactionsRes, bankRes, balanceRes] = await Promise.all([
        fetch("/api/payment/implants"),
        fetch("/api/payment/cards"),
        fetch("/api/payment/wallets"),
        fetch("/api/payment/transactions"),
        fetch("/api/bank/account"),
        fetch("/api/bank/balance"),
      ]);

      const implantsData = await implantsRes.json();
      const cardsData = await cardsRes.json();
      const walletsData = await walletsRes.json();
      const transactionsData = await transactionsRes.json();
      const bankData = await bankRes.json();
      const balanceData = await balanceRes.json();

      setImplants(implantsData.implants || []);
      setCards(cardsData.cards || []);
      setWallets(walletsData.wallets || []);
      setTransactions(transactionsData.transactions || []);
      setBankAccount(bankData.account);
      setBalance(balanceData.balance || 0);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setLoading(false);
    }
  };

  const handleCreateBankAccount = async () => {
    if (!bankEmail || !bankName) {
      setError("Please enter email and name");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/bank/account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: bankEmail,
          name: bankName,
        }),
      });
      const data = await res.json();
      
      if (data.success && data.onboardingUrl) {
        // Open Stripe onboarding in a new tab
        window.open(data.onboardingUrl, "_blank");
        
        // Close modal and reset form
        setShowBankModal(false);
        setBankEmail("");
        setBankName("");
        
        // Refresh data after a delay
        setTimeout(() => {
          fetchDashboardData();
        }, 2000);
      } else {
        setError(data.error || "Failed to create bank account");
      }
    } catch (error) {
      setError("Error creating bank account");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeposit = async () => {
    console.log("[DEBUG] Deposit button clicked", { depositAmount, bankAccount });
    if (!depositAmount || !bankAccount) {
      setError("Please enter amount and create bank account first");
      return;
    }

    console.log("[DEBUG] Processing deposit...");
    setIsProcessing(true);
    try {
      const res = await fetch("/api/bank/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          paymentMethodId: "pm_test_card",
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        console.log("[DEBUG] Deposit successful");
        setShowDepositModal(false);
        setDepositAmount("");
        fetchDashboardData();
      } else {
        console.error("[DEBUG] Deposit failed:", data.error);
        setError(data.error || "Deposit failed");
      }
    } catch (error) {
      setError("Error processing deposit");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !bankAccount) {
      setError("Please enter amount and create bank account first");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/bank/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          bankAccountId: "ba_test",
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        fetchDashboardData();
      } else {
        setError(data.error || "Withdrawal failed");
      }
    } catch (error) {
      setError("Error processing withdrawal");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/50";
      case "expiring":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "expired":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Zap className="w-12 h-12 text-magenta-500 mx-auto mb-4 animate-pulse" />
          <p className="text-foreground">Initializing Vearch Bank...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-magenta-500" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">VEARCH BANK</h1>
                <p className="text-sm text-muted-foreground">Immortal Implant Payment OS</p>
              </div>
            </div>
            <Button
              onClick={fetchDashboardData}
              variant="outline"
              className="border-magenta-500/50 hover:bg-magenta-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <Alert className="mb-6 border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {!bankAccount && (
          <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            <AlertDescription className="text-orange-400">
              <div className="flex items-center justify-between">
                <span>Create a bank account to enable deposits and payments</span>
                <Button
                  onClick={() => setShowBankModal(true)}
                  className="ml-4 bg-magenta-600 hover:bg-magenta-700"
                >
                  Create Bank Account
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-magenta-500/30 bg-card/50 backdrop-blur-sm hover:border-magenta-500/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Implants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-magenta-500">{implants.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Linked & Active</p>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:border-cyan-500/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Cards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-400">{cards.filter((c) => c.status === "active").length}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready to Use</p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-card/50 backdrop-blur-sm hover:border-green-500/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">${balance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/30 bg-card/50 backdrop-blur-sm hover:border-orange-500/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bank Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold text-orange-400">{bankAccount ? "ACTIVE" : "SETUP NEEDED"}</div>
              <p className="text-xs text-muted-foreground mt-1">Complete onboarding</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="border-b border-border bg-transparent p-0 h-auto">
            <TabsTrigger
              value="overview"
              className="border-b-2 border-transparent data-[state=active]:border-magenta-500 data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="implants"
              className="border-b-2 border-transparent data-[state=active]:border-magenta-500 data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              <Zap className="w-4 h-4 mr-2" />
              Implants
            </TabsTrigger>
            <TabsTrigger
              value="cards"
              className="border-b-2 border-transparent data-[state=active]:border-magenta-500 data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Cards
            </TabsTrigger>
            <TabsTrigger
              value="wallets"
              className="border-b-2 border-transparent data-[state=active]:border-magenta-500 data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Wallets
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="border-b-2 border-transparent data-[state=active]:border-magenta-500 data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-magenta-500/30 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-magenta-400">
                    <Plus className="w-5 h-5" />
                    Quick Deposit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">Add money to your Vearch Bank account</p>
                  <Button
                    onClick={() => setShowDepositModal(true)}
                    disabled={!bankAccount}
                    className="w-full bg-magenta-600 hover:bg-magenta-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Deposit Now
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/30 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-cyan-400">
                    <Send className="w-5 h-5" />
                    Quick Withdraw
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">Withdraw money to your bank account</p>
                  <Button
                    onClick={() => setShowWithdrawModal(true)}
                    disabled={!bankAccount}
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Withdraw
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Implants Tab */}
          <TabsContent value="implants" className="space-y-4">
            {implants.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No implants linked yet. Link your NxtPay implant to get started.</p>
                </CardContent>
              </Card>
            ) : (
              implants.map((implant) => (
                <Card key={implant.id} className="border-magenta-500/30 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{implant.implantType}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">{implant.implantId}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(implant.status)}>{implant.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Cards Tab */}
          <TabsContent value="cards" className="space-y-4">
            {cards.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No cards issued yet. Create a card to start spending.</p>
                </CardContent>
              </Card>
            ) : (
              cards.map((card) => (
                <Card key={card.id} className="border-cyan-500/30 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{card.cardholderName}</CardTitle>
                        <CardDescription>•••• •••• •••• {card.cardNumber?.slice(-4)}</CardDescription>
                        <p className="text-xs text-muted-foreground mt-1">Expires: {card.expiryMonth}/{card.expiryYear}</p>
                      </div>
                      <Badge className={getStatusColor(card.status)}>{card.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            {wallets.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No wallets linked yet. Add a funding source to get started.</p>
                </CardContent>
              </Card>
            ) : (
              wallets.map((wallet) => (
                <Card key={wallet.id} className="border-green-500/30 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{wallet.walletType}</CardTitle>
                        <CardDescription>Balance: ${wallet.balance}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(wallet.status)}>{wallet.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            {transactions.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No transactions yet. Make your first payment to see history.</p>
                </CardContent>
              </Card>
            ) : (
              transactions.map((txn) => (
                <Card key={txn.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{txn.merchantName}</CardTitle>
                        <CardDescription>{txn.description}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${txn.amount}</p>
                        <Badge className={getStatusColor(txn.status)}>{txn.status.toUpperCase()}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bank Account Modal */}
      <Dialog open={showBankModal} onOpenChange={setShowBankModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Bank Account</DialogTitle>
            <DialogDescription>
              Set up your Vearch Bank account with Stripe. You'll be redirected to complete onboarding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bank-email">Email</Label>
              <Input
                id="bank-email"
                type="email"
                placeholder="your@email.com"
                value={bankEmail}
                onChange={(e) => setBankEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bank-name">Full Name</Label>
              <Input
                id="bank-name"
                type="text"
                placeholder="John Doe"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateBankAccount}
              disabled={isProcessing || !bankEmail || !bankName}
              className="w-full bg-magenta-600 hover:bg-magenta-700"
            >
              {isProcessing ? "Creating..." : "Create & Continue to Stripe"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <DepositModal
        open={showDepositModal}
        onOpenChange={setShowDepositModal}
        onSuccess={() => {
          setDepositAmount("");
          fetchDashboardData();
        }}
        bankAccountId={bankAccount?.stripeAccountId}
      />

      {/* Withdraw Modal */}
      <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Withdraw Money</DialogTitle>
            <DialogDescription>
              Withdraw funds from your Vearch Bank account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw-amount">Amount (USD)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={isProcessing || !withdrawAmount}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {isProcessing ? "Processing..." : "Withdraw"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
