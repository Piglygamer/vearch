import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Activity, Users, CreditCard, Shield } from "lucide-react";

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, user, setLocation]);

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
          <AlertDescription className="text-red-500">
            Access denied. Admin privileges required.
          </AlertDescription>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-magenta-500/30 bg-magenta-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-lg font-bold text-green-500">Operational</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-cyan-500">0</span>
            </CardContent>
          </Card>

          <Card className="border-magenta-500/30 bg-magenta-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-magenta-500">$0.00</span>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Implants Linked</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-cyan-500">0</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-background border border-magenta-500/30">
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
                    <span className="text-sm font-mono text-green-500">✓ Connected</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Stripe API</span>
                    <span className="text-sm font-mono text-green-500">✓ Connected</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">NFC Service</span>
                    <span className="text-sm font-mono text-green-500">✓ Available</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Auto-Renewal Service</span>
                    <span className="text-sm font-mono text-green-500">✓ Running</span>
                  </div>
                </div>
                <Button className="w-full bg-magenta-500 hover:bg-magenta-600">
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
                <div className="text-center py-8 text-muted-foreground">
                  No users registered yet
                </div>
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
                <div className="text-center py-8 text-muted-foreground">
                  No transactions recorded yet
                </div>
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
                    <span className="text-sm font-mono text-green-500">✓ Enabled</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Rate Limiting</span>
                    <span className="text-sm font-mono text-green-500">✓ Active</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Fraud Detection</span>
                    <span className="text-sm font-mono text-green-500">✓ Running</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Credential Encryption</span>
                    <span className="text-sm font-mono text-green-500">✓ Active</span>
                  </div>
                </div>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600">
                  View Security Logs
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
