import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Zap, CreditCard, Wallet, TrendingUp, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Implant {
  id: number;
  implantId: string;
  implantType: string;
  status: string;
  linkedAt: string;
  expiresAt: string;
  tokenCount: number;
  activeToken?: {
    id: number;
    type: string;
    expiresAt: string;
    status: string;
    daysUntilExpiration: number;
  };
}

interface PaymentCard {
  id: number;
  cardToken: string;
  expiryMonth: number;
  expiryYear: number;
  expiryFormatted: string;
  cardholderName: string;
  status: string;
  issuedAt: string;
  maskedCardNumber: string;
}

interface Wallet {
  id: number;
  walletType: string;
  balance: string;
  currency: string;
  status: string;
  linkedAt: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  currency: string;
  merchantName: string;
  status: string;
  createdAt: string;
}

export default function Dashboard() {
  const [implants, setImplants] = useState<Implant[]>([]);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [implantsRes, cardsRes, walletsRes, transactionsRes] = await Promise.all([
        fetch("/api/payment/implants"),
        fetch("/api/payment/cards"),
        fetch("/api/payment/wallets"),
        fetch("/api/payment/transactions"),
      ]);

      if (!implantsRes.ok || !cardsRes.ok || !walletsRes.ok || !transactionsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const implantsData = await implantsRes.json();
      const cardsData = await cardsRes.json();
      const walletsData = await walletsRes.json();
      const transactionsData = await transactionsRes.json();

      setImplants(implantsData.implants || []);
      setCards(cardsData.cards || []);
      setWallets(walletsData.wallets || []);
      setTransactions(transactionsData.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
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

  const getTotalBalance = () => {
    return wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance || "0"), 0).toFixed(2);
  };

  const getExpiringImplants = () => {
    return implants.filter(
      (i) => i.activeToken && i.activeToken.daysUntilExpiration <= 30 && i.activeToken.daysUntilExpiration > 0
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Zap className="w-12 h-12 text-magenta-500 mx-auto mb-4 animate-pulse" />
          <p className="text-foreground">Initializing Vearch Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-magenta-500" />
              <h1 className="text-3xl font-bold text-foreground">VEARCH VAULT</h1>
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
          <p className="text-sm text-muted-foreground mt-2">Immortal Implant Payment OS</p>
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
              <div className="text-3xl font-bold text-green-400">${getTotalBalance()}</div>
              <p className="text-xs text-muted-foreground mt-1">Across Wallets</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/30 bg-card/50 backdrop-blur-sm hover:border-orange-500/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-400">{getExpiringImplants().length}</div>
              <p className="text-xs text-muted-foreground mt-1">Require Renewal</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {getExpiringImplants().length > 0 && (
          <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            <AlertDescription className="text-orange-400">
              {getExpiringImplants().length} implant(s) expiring within 30 days. Auto-renewal will trigger automatically.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="implants" className="space-y-4">
          <TabsList className="border-b border-border bg-transparent p-0 h-auto">
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
                <Card
                  key={implant.id}
                  className="border-magenta-500/30 bg-card/50 backdrop-blur-sm hover:border-magenta-500/50 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{implant.implantType}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">{implant.implantId}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(implant.status)}>{implant.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {implant.activeToken && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Token Type</p>
                          <p className="font-mono text-sm">{implant.activeToken.type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Days Until Expiration</p>
                          <p className="font-mono text-sm text-cyan-400">{implant.activeToken.daysUntilExpiration}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expires At</p>
                          <p className="font-mono text-xs">
                            {new Date(implant.activeToken.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge className={getStatusColor(implant.activeToken.status)}>
                            {implant.activeToken.status}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full border-magenta-500/50 hover:bg-magenta-500/10"
                      disabled={!implant.activeToken || implant.activeToken.daysUntilExpiration > 30}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Trigger Re-Provisioning
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Cards Tab */}
          <TabsContent value="cards" className="space-y-4">
            {cards.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No cards issued yet. Issue your first Vearch card.</p>
                </CardContent>
              </Card>
            ) : (
              cards.map((card) => (
                <Card
                  key={card.id}
                  className="border-cyan-500/30 bg-card/50 backdrop-blur-sm hover:border-cyan-500/50 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-mono">{card.maskedCardNumber}</CardTitle>
                        <CardDescription className="text-xs mt-1">{card.cardholderName}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(card.status)}>{card.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className="font-mono text-sm text-magenta-500">{card.expiryFormatted}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Issued</p>
                        <p className="font-mono text-xs">
                          {new Date(card.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This card is valid until {card.expiryMonth}/{card.expiryYear} — essentially immortal.
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            {wallets.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No wallets linked yet. Link a funding source.</p>
                </CardContent>
              </Card>
            ) : (
              wallets.map((wallet) => (
                <Card
                  key={wallet.id}
                  className="border-green-500/30 bg-card/50 backdrop-blur-sm hover:border-green-500/50 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg capitalize">{wallet.walletType.replace("_", " ")}</CardTitle>
                        <CardDescription className="text-xs mt-1">Funding Source</CardDescription>
                      </div>
                      <Badge className={getStatusColor(wallet.status)}>{wallet.status.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-mono text-lg text-green-400">
                          ${parseFloat(wallet.balance).toFixed(2)} {wallet.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Linked</p>
                        <p className="font-mono text-xs">
                          {new Date(wallet.linkedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            {transactions.length === 0 ? (
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No transactions yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <Card
                    key={txn.id}
                    className="border-border/30 bg-card/30 backdrop-blur-sm hover:border-border/50 transition-colors"
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{txn.merchantName}</p>
                          <p className="text-xs text-muted-foreground">{txn.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-cyan-400">
                            {txn.type === "payment" ? "-" : "+"}${parseFloat(txn.amount).toFixed(2)}
                          </p>
                          <Badge className={getStatusColor(txn.status)} variant="outline">
                            {txn.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(txn.createdAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
