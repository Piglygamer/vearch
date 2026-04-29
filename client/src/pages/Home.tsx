import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  ArrowRight,
  Bitcoin,
  CreditCard,
  Cpu,
  Shield,
  Zap,
  Globe,
} from "lucide-react";
import React, { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">VEARCH BANK</span>
          </div>
          <Button
            onClick={() => (window.location.href = getLoginUrl())}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Sign in
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm mb-8">
            <Cpu className="h-3.5 w-3.5" />
            Implant-Powered Banking
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Your body is your{" "}
            <span className="text-gradient-magenta">wallet</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Vearch Bank connects your NFC implant to a full banking platform.
            Fund your account with crypto, ACH, or wire — then tap to pay
            anywhere in the world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-base px-8"
            >
              Get Started
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-base px-8"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Everything you need for implant payments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Bitcoin,
                title: "Multi-Rail Funding",
                desc: "Deposit via BTC, ETH, SOL, USDC, USDT, ACH, or wire transfer. Withdraw to any wallet or bank.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                icon: CreditCard,
                title: "Virtual EMV Cards",
                desc: "Auto-issued virtual cards linked to your implant. Never-expiring, always ready for contactless payments.",
                color: "text-cyan",
                bg: "bg-cyan/10",
              },
              {
                icon: Shield,
                title: "Implant Security",
                desc: "Your NFC implant is your authentication. No passwords, no PINs — just tap your hand to authorize.",
                color: "text-neon-green",
                bg: "bg-neon-green/10",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 hover:border-primary/20 transition-colors"
              >
                <div
                  className={`h-12 w-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}
                >
                  <f.icon className={`h-6 w-6 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="py-20 px-4 border-t border-border/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Supported Payment Rails</h2>
          <p className="text-muted-foreground mb-10">
            Fund your account through multiple channels
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Bitcoin", sub: "BTC" },
              { name: "Ethereum", sub: "ETH" },
              { name: "Solana", sub: "SOL" },
              { name: "Stablecoins", sub: "USDC / USDT" },
            ].map((c) => (
              <div
                key={c.name}
                className="rounded-xl border border-border bg-card p-4 text-center"
              >
                <p className="font-semibold text-foreground text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-cyan shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-foreground text-sm">ACH Transfer</p>
                <p className="text-xs text-muted-foreground">
                  2-3 business days, US bank accounts
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-neon-green shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-foreground text-sm">Wire Transfer</p>
                <p className="text-xs text-muted-foreground">
                  Same day, domestic and international
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-border/30 bg-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join the Future?</h2>
          <p className="text-muted-foreground mb-8">
            Create your account in seconds and start using your implant for payments today.
          </p>
          <Button
            size="lg"
            onClick={() => (window.location.href = getLoginUrl())}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-base px-8"
          >
            Sign Up Now
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>Vearch Bank</span>
          </div>
          <span>Implant-powered finance</span>
        </div>
      </footer>
    </div>
  );
}
