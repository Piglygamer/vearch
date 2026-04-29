import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Cpu,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawalModal } from "@/components/WithdrawalModal";
import { toast } from "sonner";

// ============================================================================
// Sidebar menu
// ============================================================================
const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Cpu, label: "Implants", path: "/dashboard/implants" },
  { icon: CreditCard, label: "Cards", path: "/dashboard/cards" },
  { icon: Wallet, label: "Wallets", path: "/dashboard/wallets" },
  { icon: TrendingUp, label: "Transactions", path: "/dashboard/transactions" },
];

const SIDEBAR_WIDTH_KEY = "vearch-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// ============================================================================
// Main Dashboard Page
// ============================================================================
export default function Dashboard() {
  const { loading, user } = useAuth();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <Zap className="h-12 w-12 text-magenta" />
          <h1 className="text-2xl font-bold text-foreground">Sign in to continue</h1>
          <p className="text-muted-foreground text-center text-sm">
            Access your Vearch Bank dashboard to manage implants, cards, and payments.
          </p>
          <Button
            onClick={() => (window.location.href = getLoginUrl())}
            size="lg"
            className="w-full bg-magenta hover:bg-magenta-dark text-white"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardContent setSidebarWidth={setSidebarWidth} />
    </SidebarProvider>
  );
}

// ============================================================================
// Dashboard Content (inside SidebarProvider)
// ============================================================================
function DashboardContent({
  setSidebarWidth,
}: {
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const params = useParams<{ tab?: string }>();
  const activeTab = params?.tab || "overview";

  // Modal state
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // tRPC data
  const walletQuery = trpc.bank.getWallet.useQuery(undefined, {
    retry: 1,
    refetchInterval: 15000,
  });
  const txQuery = trpc.bank.getTransactions.useQuery(undefined, {
    retry: 1,
    refetchInterval: 15000,
  });
  const implantsQuery = trpc.implant.list.useQuery(undefined, { retry: 1 });
  const cardsQuery = trpc.card.list.useQuery(undefined, { retry: 1 });

  const balance = walletQuery.data?.balance ?? 0;
  const txns = txQuery.data ?? [];
  const implantsList = implantsQuery.data ?? [];
  const cardsList = cardsQuery.data ?? [];

  const activeMenuItem = menuItems.find((item) => item.path === location);

  // Resize logic
  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      {/* Sidebar */}
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="h-5 w-5 text-magenta shrink-0" />
                  <span className="font-bold tracking-tight truncate text-sm">
                    VEARCH BANK
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-magenta" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-magenta/20 text-magenta">
                      {user?.name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-magenta/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => !isCollapsed && setIsResizing(true)}
          style={{ zIndex: 50 }}
        />
      </div>

      {/* Main content */}
      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-sm">
                {activeMenuItem?.label ?? "Dashboard"}
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {activeTab === "overview" && (
            <OverviewTab
              balance={balance}
              implantCount={implantsList.length}
              cardCount={cardsList.filter((c) => c.status === "active").length}
              recentTxns={txns.slice(0, 5)}
              onDeposit={() => setShowDeposit(true)}
              onWithdraw={() => setShowWithdraw(true)}
              isLoading={walletQuery.isLoading}
            />
          )}
          {activeTab === "implants" && <ImplantsTab implants={implantsList} isLoading={implantsQuery.isLoading} />}
          {activeTab === "cards" && <CardsTab cards={cardsList} isLoading={cardsQuery.isLoading} />}
          {activeTab === "wallets" && <WalletsTab balance={balance} currency={walletQuery.data?.currency ?? "USD"} status={walletQuery.data?.status ?? "active"} isLoading={walletQuery.isLoading} />}
          {activeTab === "transactions" && <TransactionsTab transactions={txns} isLoading={txQuery.isLoading} />}
        </main>
      </SidebarInset>

      {/* Modals */}
      <DepositModal
        open={showDeposit}
        onOpenChange={setShowDeposit}
        onSuccess={() => {
          walletQuery.refetch();
          txQuery.refetch();
          toast.success("Deposit initiated successfully");
        }}
      />
      <WithdrawalModal
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        onSuccess={() => {
          walletQuery.refetch();
          txQuery.refetch();
          toast.success("Withdrawal initiated successfully");
        }}
        balance={balance}
      />
    </>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================
function OverviewTab({
  balance,
  implantCount,
  cardCount,
  recentTxns,
  onDeposit,
  onWithdraw,
  isLoading,
}: {
  balance: number;
  implantCount: number;
  cardCount: number;
  recentTxns: any[];
  onDeposit: () => void;
  onWithdraw: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your implant payments, cards, and wallets
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glow-green border-neon-green/20 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-9 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-neon-green font-[JetBrains_Mono]">
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Available USD</p>
          </CardContent>
        </Card>

        <Card className="border-magenta/20 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Implants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-magenta">{implantCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Linked devices</p>
          </CardContent>
        </Card>

        <Card className="border-cyan/20 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan">{cardCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active cards</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{recentTxns.length > 0 ? recentTxns.length : 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="border-magenta/20 bg-card hover:border-magenta/40 transition-colors cursor-pointer group"
          onClick={onDeposit}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-magenta/10 flex items-center justify-center group-hover:bg-magenta/20 transition-colors">
              <ArrowDownLeft className="h-6 w-6 text-magenta" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Deposit</h3>
              <p className="text-sm text-muted-foreground">
                Add funds via crypto, ACH, or wire
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-cyan/20 bg-card hover:border-cyan/40 transition-colors cursor-pointer group"
          onClick={onWithdraw}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-cyan/10 flex items-center justify-center group-hover:bg-cyan/20 transition-colors">
              <ArrowUpRight className="h-6 w-6 text-cyan" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Withdraw</h3>
              <p className="text-sm text-muted-foreground">
                Send to crypto wallet, bank, or wire
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No transactions yet. Make your first deposit to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTxns.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        txn.type === "topup"
                          ? "bg-neon-green/10 text-neon-green"
                          : "bg-neon-red/10 text-neon-red"
                      }`}
                    >
                      {txn.type === "topup" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {txn.type === "topup" ? "Deposit" : "Withdrawal"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {txn.description?.slice(0, 40) || "Transaction"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold font-[JetBrains_Mono] ${
                        txn.type === "topup" ? "text-neon-green" : "text-neon-red"
                      }`}
                    >
                      {txn.type === "topup" ? "+" : "-"}$
                      {txn.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        txn.status === "completed"
                          ? "border-neon-green/30 text-neon-green"
                          : txn.status === "pending"
                            ? "border-yellow-500/30 text-yellow-500"
                            : "border-neon-red/30 text-neon-red"
                      }`}
                    >
                      {txn.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Implants Tab
// ============================================================================
function ImplantsTab({ implants, isLoading }: { implants: any[]; isLoading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Implants</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your NFC payment implants
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : implants.length === 0 ? (
        <Card className="border-dashed border-magenta/30 bg-card">
          <CardContent className="py-12 text-center">
            <Cpu className="h-12 w-12 text-magenta/30 mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No implants linked</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Connect your Apex Flex or NFC implant to enable tap-to-pay transactions.
              Hold your implant near your device to begin.
            </p>
            <Button
              className="mt-4 bg-magenta hover:bg-magenta-dark text-white"
              onClick={() => toast.info("NFC scanning requires a compatible device")}
            >
              <Zap className="h-4 w-4 mr-2" />
              Link Implant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {implants.map((implant) => (
            <Card key={implant.id} className="border-magenta/20 bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-magenta/10 flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-magenta" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{implant.implantType}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {implant.implantId}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    implant.status === "active"
                      ? "border-neon-green/30 text-neon-green"
                      : "border-yellow-500/30 text-yellow-500"
                  }
                >
                  {implant.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Cards Tab
// ============================================================================
function CardsTab({ cards, isLoading }: { cards: any[]; isLoading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cards</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Virtual EMV cards linked to your implants
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card className="border-dashed border-cyan/30 bg-card">
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-cyan/30 mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No cards issued</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Virtual cards are automatically issued when you link an implant and fund your wallet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="relative rounded-xl p-6 bg-gradient-to-br from-magenta-dark/40 via-card to-cyan-dark/20 border border-magenta/20 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-magenta/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <Zap className="h-6 w-6 text-magenta" />
                  <Badge
                    variant="outline"
                    className={
                      card.status === "active"
                        ? "border-neon-green/30 text-neon-green"
                        : "border-neon-red/30 text-neon-red"
                    }
                  >
                    {card.status}
                  </Badge>
                </div>
                <p className="text-lg font-mono tracking-[0.2em] text-foreground mb-4">
                  **** **** **** {card.last4}
                </p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Cardholder
                    </p>
                    <p className="text-sm font-medium">{card.cardholderName || "Vearch User"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase">
                      Expires
                    </p>
                    <p className="text-sm font-mono">
                      {String(card.expiryMonth).padStart(2, "0")}/{card.expiryYear}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Wallets Tab
// ============================================================================
function WalletsTab({
  balance,
  currency,
  status,
  isLoading,
}: {
  balance: number;
  currency: string;
  status: string;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wallets</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your funding sources and balances
        </p>
      </div>

      <Card className="glow-green border-neon-green/20 bg-card">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="h-16 w-48 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Primary Wallet
              </p>
              <div className="text-4xl font-bold text-neon-green font-[JetBrains_Mono] mb-2">
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-neon-green/30 text-neon-green text-[10px]">
                  {status}
                </Badge>
                <span className="text-xs text-muted-foreground">{currency}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "Cryptocurrency", desc: "BTC, ETH, SOL, USDC, USDT", time: "10-30 min", color: "text-magenta" },
            { name: "ACH Transfer", desc: "US bank account", time: "2-3 business days", color: "text-cyan" },
            { name: "Wire Transfer", desc: "Domestic / international", time: "Same day", color: "text-neon-green" },
          ].map((m) => (
            <div key={m.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className={`text-sm font-medium ${m.color}`}>{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <span className="text-xs text-muted-foreground">{m.time}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Transactions Tab
// ============================================================================
function TransactionsTab({
  transactions,
  isLoading,
}: {
  transactions: any[];
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Complete history of deposits, withdrawals, and payments
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="border-dashed border-border bg-card">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No transactions</h3>
            <p className="text-sm text-muted-foreground">
              Your transaction history will appear here once you make a deposit or payment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        txn.type === "topup"
                          ? "bg-neon-green/10 text-neon-green"
                          : txn.type === "transfer"
                            ? "bg-neon-red/10 text-neon-red"
                            : "bg-cyan/10 text-cyan"
                      }`}
                    >
                      {txn.type === "topup" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {txn.type === "topup"
                          ? "Deposit"
                          : txn.type === "transfer"
                            ? "Withdrawal"
                            : txn.type === "payment"
                              ? txn.merchantName || "Payment"
                              : txn.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {txn.createdAt
                          ? new Date(txn.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold font-[JetBrains_Mono] ${
                        txn.type === "topup" ? "text-neon-green" : "text-neon-red"
                      }`}
                    >
                      {txn.type === "topup" ? "+" : "-"}$
                      {txn.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        txn.status === "completed"
                          ? "border-neon-green/30 text-neon-green"
                          : txn.status === "pending"
                            ? "border-yellow-500/30 text-yellow-500"
                            : "border-neon-red/30 text-neon-red"
                      }`}
                    >
                      {txn.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
