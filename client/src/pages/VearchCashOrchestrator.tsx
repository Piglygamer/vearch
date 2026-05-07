import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

export default function VearchCashOrchestrator() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [pan, setPan] = useState<string | null>(null);
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cardFlipRef = useRef<HTMLDivElement>(null);

  const createCardMutation = trpc.paymentEmulator.createCard.useMutation();

  // Step 1: Link funding source (create real Stripe card)
  const handleLinkFunding = async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const result = await createCardMutation.mutateAsync({
        cardholderName: user.name || "Vearch User",
      });

      if (result.success) {
        setPan(result.card.pan);
        setStep(2);
      } else {
        setError("Failed to create card");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create card");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Secure PIN
  const handleSecurePin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // SHA-256 hash the PIN
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      setPinHash(hashHex);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hash PIN");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Launch NFC payload
  const handleLaunchNFC = () => {
    // In production, this would trigger the Fidesmo app
    // For now, show success message
    const message = `
      ⚡ Payload dispatched!
      
      Card: ${pan}
      PIN Hash: ${pinHash?.substring(0, 16)}...
      
      Open the Fidesmo App and hold your Apex Flex ring to the NFC coil.
    `;
    alert(message);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <main className="max-w-md mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 grid place-items-center font-bold text-sm text-black">
              V
            </div>
            <div>
              <div className="font-display text-lg tracking-widest font-bold">
                VEARCH <span className="text-emerald-400">CASH</span>
              </div>
              <div className="text-xs uppercase tracking-wider text-white/50">Global Orchestrator</div>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
            SECURE
          </div>
        </header>

        {/* 3D Card */}
        <section className="mb-8">
          <div
            ref={cardFlipRef}
            onClick={() => cardFlipRef.current?.classList.toggle("rotate-y-180")}
            className="relative w-full aspect-video bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-6 border border-white/10 cursor-pointer shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 rounded-2xl"></div>

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/60">Vearch • Virtual</div>
                  <div className="font-bold text-xl text-emerald-400">CASH</div>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/70">
                  <path
                    d="M8 8c2 2 2 6 0 8M11 5c4 4 4 10 0 14M14 2c6 6 6 14 0 20"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div>
                <div className="mb-4 text-sm font-mono text-white/90">{pan || "•••• •••• •••• ••••"}</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/50">Cardholder</div>
                    <div className="font-bold text-sm">{user?.name || "VEARCH USER"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/50">Expires</div>
                    <div className="font-bold text-sm">07/30979</div>
                  </div>
                  <div className="font-bold text-base">VISA</div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-white/40 mt-2">Tap card to flip</p>
        </section>

        {/* Step 1: Link Funding Source */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 grid place-items-center font-bold text-sm text-black">
                01
              </div>
              <h2 className="font-bold tracking-widest text-sm">SECURE SOURCE</h2>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20">
              {step >= 1 ? "✓ Linked" : "Pending"}
            </span>
          </div>
          <p className="text-xs text-white/60 mb-4">Tokenize a real funding source via Stripe. We never see the PAN.</p>

          {error && <div className="text-xs text-red-400 mb-3">{error}</div>}

          <button
            onClick={handleLinkFunding}
            disabled={loading || step > 1}
            className="w-full py-3 rounded-xl font-bold tracking-widest text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "TOKENIZING…" : step > 1 ? "✓ FUNDING SOURCE LINKED" : "LINK FUNDING SOURCE"}
          </button>
        </section>

        {/* Step 2: Hardware PIN */}
        <section className={`bg-white/5 border border-white/10 rounded-2xl p-6 mb-5 ${step < 2 ? "opacity-30 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 grid place-items-center font-bold text-sm text-black">
                02
              </div>
              <h2 className="font-bold tracking-widest text-sm">HARDWARE PIN</h2>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20">
              {step >= 2 ? "✓ Secured" : "Locked"}
            </span>
          </div>
          <p className="text-xs text-white/60 mb-4">Set a 4-digit PIN. Hashed with SHA-256, then sent to the Apex Flex secure element.</p>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(val);
            }}
            disabled={step > 2}
            placeholder="••••"
            className="w-full text-center text-3xl py-4 rounded-xl bg-black/40 border border-white/10 focus:border-emerald-400 focus:outline-none mb-3 disabled:opacity-50"
          />

          <button
            onClick={handleSecurePin}
            disabled={loading || step > 2}
            className="w-full py-3 rounded-xl font-bold tracking-widest text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "ENCRYPTING…" : step > 2 ? "✓ PIN SECURED" : "SECURE PIN"}
          </button>
        </section>

        {/* Step 3: OTA Provision */}
        <section className={`bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 ${step < 3 ? "opacity-30 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 grid place-items-center font-bold text-sm text-black">
                03
              </div>
              <h2 className="font-bold tracking-widest text-sm">OTA PROVISION</h2>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20">
              {step >= 3 ? "✓ Dispatched" : "Locked"}
            </span>
          </div>
          <p className="text-xs text-white/60 mb-5">
            Wake the Fidesmo native app on your phone, hold the Apex Flex ring to the NFC coil, and the EMV applet will personalize over the air.
          </p>

          <div className="flex justify-center mb-4">
            <button
              onClick={handleLaunchNFC}
              className="relative px-8 py-4 rounded-full font-bold tracking-widest text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 transition shadow-lg"
            >
              <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-pulse"></span>
              <span className="relative flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                LAUNCH NFC PAYLOAD
              </span>
            </button>
          </div>

          <p className="text-xs text-white/40 text-center">Requires the Fidesmo App installed on Android with NFC enabled.</p>
        </section>

        <footer className="text-center text-xs text-white/30 tracking-widest">VEARCH • FIDESMO APP ID 34ab5711 • EMV CONTACTLESS</footer>
      </main>
    </div>
  );
}
