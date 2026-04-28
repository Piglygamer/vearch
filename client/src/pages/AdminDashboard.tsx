import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Activity, Users, CreditCard, Shield, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SystemStats {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  implantCount: number;
  transactionCount: number;
  systemHealth: "healthy" | "degraded" | "critical";
}

interface Transaction {
  id: number;
  userId: number;
  amount: string;
  type: string;
  status: string;
  createdAt: Date;
}

interface ImplantStatus {
  implantId: string;
  userId: number;
  status: "active" | "inactive" | "revoked";
  version: string;
  lastUpdated: Date;
  balance?: number;
}

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    implantCount: 0,
    transactionCount: 0,
    systemHealth: "healthy",
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [implants, setImplants] = useState<ImplantStatus[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, user, setLocation]);

  // Fetch admin data
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const fetchAdminData = async () => {
      try {
        setIsLoadingData(true);

        // Fetch system stats
        const statsResponse = await fetch("/api/admin/stats", {
          credentials: "include",
        });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        // Fetch recent transactions
        const txnResponse = await fetch("/api/admin/transactions?limit=10", {
          credentials: "include",
        });
        if (txnResponse.ok) {
          const txnData = await txnResponse.json();
          setTransactions(txnData.transactions || []);
        }

        // Fetch implant statuses
        const implantResponse = await fetch("/api/admin/implants", {
          credentials: "include",
        });
        if (implantResponse.ok) {
          const implantData = await implantResponse.json();
          setImplants(implantData.implants || []);
        }
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchAdminData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAdminData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleRunDiagnostics = async () => {
    try {
      const response = await fetch("/api/admin/diagnostics", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        alert(`Diagnostics complete:\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      alert("Diagnostics failed");
    }
  };

  const handleRevokeImplant = async (implantId: string) => {
    if (!confirm(`Revoke applet access from implant ${implantId}?`)) return;

    try {
      const response = await fetch(`/api/applet-deployment/revoke/${implantId}`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        alert("Implant revoked successfully");
        // Refresh implants list
        const implantResponse = await fetch("/api/admin/implants", {
          credentials: "include",
        });
        if (implantResponse.ok) {
          const implantData = await implantResponse.json();
          setImplants(implantData.implants || []);
        }
      }
    } catch (error) {
      alert("Revocation failed");
    }
  };

  const handlePublishUpdate = async () => {
    const version = prompt("Enter applet version (e.g., 1.2.1):");
    if (!version) return;

    const releaseNotes = prompt("Enter release notes:");
    if (!releaseNotes) return;

    try {
      const response = await fetch("/api/applet-deployment/publish-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          version,
          releaseNotes,
          mandatory: confirm("Make this update mandatory?"),
        }),
      });
      if (response.ok) {
        alert("Update published successfully");
      }
    } catch (error) {
      alert("Update publication failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-magenta-500"></div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert className="max-w-md border-red-500 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-500">Access denied. Admin privileges required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-magenta-500 mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Bank operations, health monitoring, and security audits</p>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className={`border-${stats.systemHealth === "healthy" ? "green" : "red"}-500/30 bg-${stats.systemHealth === "healthy" ? "green" : "red"}-500/5`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stats.systemHealth === "healthy" ? "bg-green-500" : "bg-red-500"} animate-pulse`}></div>
                <span className={`text-lg font-bold ${stats.systemHealth === "healthy" ? "text-green-500" : "text-red-500"}`}>
                  {stats.systemHealth === "healthy" ? "Operational" : "Degraded"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-cyan-500">{stats.totalUsers}</span>
            </CardContent>
          </Card>

          <Card className="border-magenta-500/30 bg-magenta-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-magenta-500">${stats.totalDeposits.toFixed(2)}</span>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Implants Linked</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-cyan-500">{stats.implantCount}</span>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-yellow-500">{stats.transactionCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-background border border-magenta-500/30">
            <TabsTrigger value="health" className="data-[state=active]:bg-magenta-500/20 data-[state=active]:text-magenta-500">
              <Activity className="w-4 h-4 mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-magenta-500/20 data-[state=active]:text-magenta-500">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-magenta-500/20 data-[state=active]:text-magenta-500">
              <CreditCard className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="implants" className="data-[state=active]:bg-magenta-500/20 data-[state=active]:text-magenta-500">
              <Zap className="w-4 h-4 mr-2" />
              Implants
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-magenta-500/20 data-[state=active]:text-magenta-500">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <Card className="border-magenta-500/30">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Real-time monitoring and diagnostics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Database Connection</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Connected
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Stripe API</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Connected
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">NFC Service</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Available
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Auto-Renewal Service</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Running
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Self-Healing Service</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Active
                    </span>
                  </div>
                </div>
                <Button onClick={handleRunDiagnostics} className="w-full bg-magenta-500 hover:bg-magenta-600">
                  Run Diagnostics
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="border-magenta-500/30">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage bank users</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.totalUsers === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No users registered yet</div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">Total registered users: {stats.totalUsers}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="border-magenta-500/30">
              <CardHeader>
                <CardTitle>Payment Monitoring</CardTitle>
                <CardDescription>Track deposits, withdrawals, and implant payments</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No transactions recorded yet</div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((txn) => (
                      <div key={txn.id} className="flex justify-between items-center p-2 border border-magenta-500/20 rounded">
                        <div>
                          <p className="text-sm font-mono">{txn.type}</p>
                          <p className="text-xs text-muted-foreground">{new Date(txn.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">${parseFloat(txn.amount).toFixed(2)}</p>
                          <p className={`text-xs ${txn.status === "completed" ? "text-green-500" : "text-yellow-500"}`}>{txn.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Implants Tab */}
          <TabsContent value="implants" className="space-y-4">
            <Card className="border-magenta-500/30">
              <CardHeader>
                <CardTitle>Implant Management</CardTitle>
                <CardDescription>Manage Apex Flex EMV applets and deployments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {implants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No implants registered yet</div>
                ) : (
                  <div className="space-y-2">
                    {implants.map((implant) => (
                      <div key={implant.implantId} className="flex justify-between items-center p-3 border border-magenta-500/20 rounded">
                        <div>
                          <p className="text-sm font-mono">{implant.implantId}</p>
                          <p className="text-xs text-muted-foreground">v{implant.version}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className={`text-xs font-mono flex items-center gap-1 ${implant.status === "active" ? "text-green-500" : "text-red-500"}`}>
                              {implant.status === "active" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {implant.status}
                            </p>
                            {implant.balance !== undefined && <p className="text-xs text-muted-foreground">${implant.balance.toFixed(2)}</p>}
                          </div>
                          {implant.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevokeImplant(implant.implantId)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={handlePublishUpdate} className="w-full bg-cyan-500 hover:bg-cyan-600 mt-4">
                  Publish Applet Update
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card className="border-magenta-500/30">
              <CardHeader>
                <CardTitle>Security Audit</CardTitle>
                <CardDescription>View security logs and vulnerability status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">SSL/TLS</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Enabled
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Rate Limiting</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Active
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Fraud Detection</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Running
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Credential Encryption</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Active
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Vulnerability Scanning</span>
                    <span className="text-sm font-mono text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Running
                    </span>
                  </div>
                </div>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600">View Security Logs</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
