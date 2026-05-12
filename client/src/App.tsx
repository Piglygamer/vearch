import React from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import PaymentEmulator from "./pages/PaymentEmulator";
import MicrochipDeployment from "./pages/MicrochipDeployment";
import VearchCashOrchestrator from "./pages/VearchCashOrchestrator";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/home" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/:tab" component={Dashboard} />
      <Route path="/payment-emulator" component={PaymentEmulator} />
      <Route path="/microchip-deployment" component={MicrochipDeployment} />
      <Route path="/vearch-cash" component={VearchCashOrchestrator} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "oklch(0.14 0.02 280)",
                border: "1px solid oklch(0.22 0.03 280)",
                color: "oklch(0.93 0.01 280)",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
