/**
 * Middleman bridge: minimal phone-side terminal demo.
 *
 * This page is what a connected merchant would open on their phone. It scans
 * the implant via Web NFC, asks for an amount, and POSTs to the API as the
 * merchant. The merchant API key is supplied by the operator at the start of
 * the session; it is held only in component state, never persisted.
 *
 * NOTE: This calls the tRPC `merchant.charge` endpoint via raw fetch (rather
 * than the tRPC client) because the tRPC client in `main.tsx` is configured
 * for the user-session cookie, not merchant API-key auth.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react";

type ChargeResult =
  | { approved: true; paymentIntentId: string; amountCents: number; currency: string }
  | { approved: false; declineCode: string; message: string; paymentIntentId?: string };

async function postCharge(
  apiKey: string,
  body: { uid: string; amountCents: number; currency?: string; idempotencyKey?: string }
): Promise<ChargeResult> {
  const res = await fetch("/api/trpc/merchant.charge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vearch-merchant-key": apiKey,
    },
    body: JSON.stringify({ json: body }),
  });
  if (res.status === 401) {
    throw new Error("Invalid merchant API key");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  // tRPC HTTP envelope:
  // { result: { data: { json: <ChargeResult> } } }
  const inner = json?.result?.data?.json ?? json?.result?.data;
  if (!inner) throw new Error("Unexpected response shape");
  return inner as ChargeResult;
}

export default function TerminalDemo() {
  const [apiKey, setApiKey] = useState("");
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [uid, setUid] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [scanning, setScanning] = useState(false);
  const [posting, setPosting] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ChargeResult | null>(null);

  useEffect(() => {
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  async function handleScan() {
    setError(null);
    if (!nfcSupported) {
      setError("Web NFC isn't available on this device. Type the UID instead.");
      return;
    }
    setScanning(true);
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.onreading = (event: any) => {
        const serial = typeof event?.serialNumber === "string" ? event.serialNumber : "";
        if (serial) setUid(serial);
        setScanning(false);
      };
      ndef.onreadingerror = () => {
        setError("Could not read chip. Try again.");
        setScanning(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFC scan failed");
      setScanning(false);
    }
  }

  async function handleCharge() {
    setError(null);
    setLast(null);
    const dollars = parseFloat(amountDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (uid.trim().length < 8) {
      setError("Scan or type a chip UID first.");
      return;
    }
    const cents = Math.round(dollars * 100);
    setPosting(true);
    try {
      const r = await postCharge(apiKey, {
        uid: uid.trim(),
        amountCents: cents,
        currency: "usd",
        idempotencyKey: `terminal-${Date.now()}`,
      });
      setLast(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Charge failed");
    } finally {
      setPosting(false);
    }
  }

  if (!keyConfirmed) {
    return (
      <main className="mx-auto max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Terminal demo</h1>
        <p className="text-sm text-muted-foreground">
          Paste your merchant API key (<code>vmk_…</code>) to start a session. The key is held only in
          this tab's memory.
        </p>
        <div className="space-y-2">
          <Label htmlFor="merchant-key">Merchant API key</Label>
          <Input
            id="merchant-key"
            type="password"
            placeholder="vmk_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={!apiKey.startsWith("vmk_")}
          onClick={() => setKeyConfirmed(true)}
        >
          Start session
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Terminal demo</h1>

      <div className="space-y-2">
        <Label htmlFor="terminal-uid">Chip UID</Label>
        <div className="flex gap-2">
          <Input
            id="terminal-uid"
            placeholder="04:A2:38:9B:5C:80…"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            disabled={scanning}
          />
          <Button type="button" variant="outline" onClick={handleScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input
          id="amount"
          inputMode="decimal"
          placeholder="4.50"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
        />
      </div>

      <Button className="w-full" onClick={handleCharge} disabled={posting}>
        {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Charge"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {last && last.approved && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Approved — {(last.amountCents / 100).toFixed(2)} {last.currency.toUpperCase()} ·{" "}
            <code>{last.paymentIntentId}</code>
          </AlertDescription>
        </Alert>
      )}
      {last && !last.approved && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Declined ({last.declineCode}): {last.message}
          </AlertDescription>
        </Alert>
      )}
    </main>
  );
}
