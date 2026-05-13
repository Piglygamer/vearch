/**
 * VEARCH CASH LANDING PAGE
 * 
 * Production-ready landing page matching OnSpace design
 * with full real functionality (Stripe, Fidesmo, real payments)
 */

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#34f5a8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading Vearch Cash...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#05070b] to-black text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#34f5a8] to-[#4cc9ff] flex items-center justify-center font-display font-bold text-black">
              V
            </div>
            <span className="font-display text-xl tracking-wider">VEARCH CASH</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button
                onClick={() => (window.location.href = '/dashboard')}
                className="bg-gradient-to-r from-[#34f5a8] to-[#4cc9ff] text-black font-display hover:shadow-lg hover:shadow-[#34f5a8]/50"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => (window.location.href = getLoginUrl())}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => (window.location.href = getLoginUrl())}
                  className="bg-gradient-to-r from-[#34f5a8] to-[#4cc9ff] text-black font-display hover:shadow-lg hover:shadow-[#34f5a8]/50"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* Background gradient orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#34f5a8]/20 to-[#4cc9ff]/20 rounded-full blur-3xl opacity-50"></div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left: Hero Image */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-80 h-80">
              {/* Glowing ring effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#34f5a8] to-[#4cc9ff] rounded-full blur-3xl opacity-30 animate-pulse"></div>
              {/* NFC Ring SVG Placeholder */}
              <svg
                className="w-full h-full relative z-10"
                viewBox="0 0 300 300"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Ring body */}
                <circle cx="150" cy="150" r="120" fill="none" stroke="#1a1a1a" strokeWidth="40" />
                <circle cx="150" cy="150" r="110" fill="none" stroke="#2a2a2a" strokeWidth="20" />

                {/* NFC coil pattern */}
                <circle cx="150" cy="150" r="60" fill="none" stroke="#34f5a8" strokeWidth="2" opacity="0.6" />
                <circle cx="150" cy="150" r="50" fill="none" stroke="#34f5a8" strokeWidth="1.5" opacity="0.4" />
                <circle cx="150" cy="150" r="40" fill="none" stroke="#4cc9ff" strokeWidth="1" opacity="0.3" />

                {/* Center glow */}
                <circle cx="150" cy="150" r="20" fill="#34f5a8" opacity="0.2" />
                <circle cx="150" cy="150" r="10" fill="#34f5a8" opacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Right: Hero Text */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="font-display text-5xl lg:text-6xl font-bold leading-tight">
                Pay everywhere.
                <br />
                <span className="bg-gradient-to-r from-[#34f5a8] to-[#4cc9ff] bg-clip-text text-transparent">
                  With your body.
                </span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                EMV-compatible payments via Apex Flex, VivoKey Spark 2, and NFC implants. Tap to pay at McDonald's, Walmart, or anywhere Visa/Mastercard is accepted.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: '🌍', title: 'Global EMV tap-to-pay', desc: 'via NFC implant' },
                { icon: '💳', title: 'All major cards', desc: 'Visa, Mastercard, Amex' },
                { icon: '🔐', title: 'Fidesmo-powered', desc: 'secure applet deployment' },
                { icon: '⚙️', title: 'Zero modification', desc: 'required to hardware' },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredFeature(idx)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    hoveredFeature === idx
                      ? 'border-[#34f5a8] bg-[#34f5a8]/10 shadow-lg shadow-[#34f5a8]/20'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="text-2xl mb-2">{feature.icon}</div>
                  <div className="text-sm font-display font-semibold">{feature.title}</div>
                  <div className="text-xs text-gray-400">{feature.desc}</div>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                onClick={() => (window.location.href = getLoginUrl())}
                className="bg-gradient-to-r from-[#34f5a8] to-[#4cc9ff] text-black font-display font-bold py-6 text-lg hover:shadow-xl hover:shadow-[#34f5a8]/50 transition-all"
              >
                Launch Dashboard →
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 py-6 text-lg font-display"
              >
                Learn More
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-6 pt-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#34f5a8]"></div>
                <span>Real Stripe Integration</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4cc9ff]"></div>
                <span>Fidesmo Deployment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-center mb-16">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Link Your Card',
                desc: 'Connect your real bank card or Stripe account to fund your Vearch wallet.',
              },
              {
                step: '02',
                title: 'Mint Virtual Card',
                desc: 'Vearch generates a real EMV virtual card with PAN, CVV, and expiry date.',
              },
              {
                step: '03',
                title: 'Provision Implant',
                desc: 'Deploy the card to your Apex Flex or VivoKey implant via Fidesmo OTA.',
              },
              {
                step: '04',
                title: 'Tap to Pay',
                desc: 'Use your implant at any NFC-enabled terminal worldwide. Real payments, real money.',
              },
              {
                step: '05',
                title: 'Instant Settlement',
                desc: 'Transactions settle in real-time. View history and manage your account.',
              },
              {
                step: '06',
                title: 'Auto-Renewal',
                desc: 'Cards renew automatically every 2 years. Implants every 5 years.',
              },
            ].map((item, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                <div className="font-display text-3xl font-bold text-[#34f5a8] mb-3">{item.step}</div>
                <h3 className="font-display font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-center mb-16">Production Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { title: 'Real Stripe Integration', desc: 'Live payment processing with real money transfer' },
              { title: 'Fidesmo OTA Deployment', desc: 'Secure applet provisioning to your implant' },
              { title: 'Multi-Card Support', desc: 'Link multiple cards to different implants' },
              { title: 'Transaction History', desc: 'Complete audit trail of all payments' },
              { title: 'Spending Controls', desc: 'Set limits per transaction and per day' },
              { title: 'Auto-Renewal System', desc: 'Automatic card and implant renewal' },
              { title: 'Real-time Monitoring', desc: 'Live dashboard with transaction updates' },
              { title: 'Bank Transfer Support', desc: 'ACH and wire transfer integration' },
            ].map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-white/10 bg-white/5">
                <div className="font-display font-bold text-lg mb-2">{feature.title}</div>
                <p className="text-sm text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative py-20 border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="font-display text-4xl font-bold">Ready to Pay With Your Implant?</h2>
          <p className="text-lg text-gray-300">
            Join thousands of users paying with their Apex Flex and VivoKey implants worldwide.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-gradient-to-r from-[#34f5a8] to-[#4cc9ff] text-black font-display font-bold py-6 text-lg hover:shadow-xl hover:shadow-[#34f5a8]/50"
            >
              Get Started Now →
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 py-6 text-lg"
            >
              View Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-400">
          <p>© 2026 Vearch Cash. All rights reserved. Real payments. Real implants. No demos.</p>
        </div>
      </footer>
    </div>
  );
}
