import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Zap, Shield, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function VearchCashLanding() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Fuzzy texture overlay */}
      <div 
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 400 400%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 /%3E%3C/filter%3E%3Crect width=%22400%22 height=%22400%22 filter=%22url(%23noiseFilter)%22 /%3E%3C/svg%3E')",
          backgroundSize: "200px 200px"
        }}
      />

      {/* Gradient orbs */}
      <div className="fixed top-20 right-10 w-96 h-96 bg-yellow-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-yellow-600/20">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-600/20 border border-yellow-600/40 flex items-center justify-center">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <span className="text-xl font-bold text-white">Vearch Cash</span>
          </div>
          <div className="flex gap-3">
            {isAuthenticated ? (
              <Button 
                onClick={() => navigate("/dashboard")}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline"
                  className="border-yellow-600/40 text-yellow-500 hover:bg-yellow-600/10"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  Sign In
                </Button>
                <Button 
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  Create Account
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: NFC Ring Image */}
          <div className="flex justify-center">
            <div className="relative w-80 h-80">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 to-yellow-500/10 rounded-full blur-2xl" />
              
              {/* Ring illustration */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 rounded-full border-4 border-yellow-600/30 flex items-center justify-center relative">
                  {/* Inner glow */}
                  <div className="absolute inset-4 rounded-full border-2 border-yellow-500/40" />
                  
                  {/* Center dot */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 shadow-lg shadow-yellow-600/50" />
                  
                  {/* Ripple effect */}
                  <div className="absolute inset-0 rounded-full border border-yellow-600/20 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-white">Pay everywhere.</span>
                <br />
                <span className="text-yellow-500">With your body.</span>
              </h1>
              
              <p className="text-xl text-gray-400 leading-relaxed">
                EMV-compatible payments via Apex Flex, VivoKey Spark 2, and NFC implants. Tap to pay at McDonald's, Walmart, or anywhere Visa/Mastercard is accepted.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
                <span className="text-gray-300">Global EMV tap-to-pay via NFC implant</span>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
                <span className="text-gray-300">All Visa, Mastercard, and Amex cards supported</span>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
                <span className="text-gray-300">Fidesmo-powered secure applet deployment</span>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
                <span className="text-gray-300">Zero hardware modification required</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button 
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold text-lg px-8 py-6"
                onClick={() => isAuthenticated ? navigate("/dashboard") : window.location.href = getLoginUrl()}
              >
                Get Started <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                variant="outline"
                className="border-yellow-600/40 text-yellow-500 hover:bg-yellow-600/10 font-bold text-lg px-8 py-6"
                onClick={() => navigate("/dashboard")}
              >
                View Demo
              </Button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-32 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-white">How It Works</h2>
            <p className="text-xl text-gray-400">Three simple steps to implant payments</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Link Your Card",
                desc: "Connect your bank account or credit card to fund your Vearch wallet"
              },
              {
                step: "2",
                title: "Deploy to Implant",
                desc: "Provision your NFC implant with a real EMV payment applet via Fidesmo"
              },
              {
                step: "3",
                title: "Tap to Pay",
                desc: "Use your implant at any NFC terminal worldwide - works like a real card"
              }
            ].map((item) => (
              <Card key={item.step} className="bg-black border-yellow-600/20 p-8 hover:border-yellow-600/40 transition-colors">
                <div className="w-12 h-12 rounded-full bg-yellow-600/20 border border-yellow-600/40 flex items-center justify-center mb-6">
                  <span className="text-yellow-500 font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-32 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-white">Production Ready</h2>
            <p className="text-xl text-gray-400">Enterprise-grade payment infrastructure</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "Real Stripe Processing", desc: "Live payment processing with real charges" },
              { title: "Fidesmo Integration", desc: "Secure NFC applet deployment to implants" },
              { title: "Bank Transfer Support", desc: "ACH, wire, and crypto funding options" },
              { title: "Global EMV", desc: "Works at any Visa/Mastercard terminal" },
              { title: "Zero Simulator", desc: "No demo mode - everything is production" },
              { title: "Implant Agnostic", desc: "Apex Flex, VivoKey, and any NFC chip" }
            ].map((feature, i) => (
              <div key={i} className="border border-yellow-600/20 rounded-lg p-6 hover:border-yellow-600/40 transition-colors">
                <h3 className="text-lg font-bold text-yellow-500 mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-yellow-600/20 mt-32">
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-gray-500">
          <p>© 2026 Vearch Cash. Real payments. Real implants. No simulators.</p>
        </div>
      </footer>
    </div>
  );
}
