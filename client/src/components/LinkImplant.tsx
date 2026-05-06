/**
 * Middleman bridge: link a chip UID to the signed-in user.
 *
 * Reads the chip's UID via Web NFC (`NDEFReader.scan`) when available, or
 * accepts a manually-typed UID for desktop users. The UID is sent to
 * `implantsBridge.link` and stored on the user — no applet, no PAN.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LinkImplantProps {
  onLinked?: (uid: string) => void;
}

/** Extract a usable UID from an NFC reading event. */
function extractUid(event: any): string | null {
  // Prefer the chip's serialNumber if the browser exposes it.
  if (typeof event?.serialNumber === "string" && event.serialNumber.length > 0) {
    return event.serialNumber;
  }
  // Fall back to the first NDEF text record.
  const records = event?.message?.records ?? [];
  if (records.length > 0) {
    try {
      return new TextDecoder().decode(records[0].data);
    } catch {
      return null;
    }
  }
  return null;
}

export function LinkImplant({ onLinked }: LinkImplantProps) {
  const [uid, setUid] = useState("");
  const [label, setLabel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const link = trpc.implantsBridge.link.useMutation({
    onSuccess: (r) => {
      setDone(true);
      onLinked?.(r.uid);
    },
    onError: (e) => setError(e.message),
  });

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
        const u = extractUid(event);
        if (u) setUid(u);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (uid.trim().length < 8) {
      setError("UID is too short.");
      return;
    }
    link.mutate({ uid: uid.trim(), label: label.trim() || undefined });
  }

  if (done) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>Implant linked. It can now be used at any participating terminal.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="implant-uid">Chip UID</Label>
        <div className="flex gap-2">
          <Input
            id="implant-uid"
            placeholder="04:A2:38:9B:5C:80…"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            disabled={scanning}
          />
          <Button type="button" variant="outline" onClick={handleScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span className="ml-2">Scan</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="implant-label">Label (optional)</Label>
        <Input
          id="implant-label"
          placeholder="Left hand"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={link.isPending} className="w-full">
        {link.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link implant"}
      </Button>
    </form>
  );
}

export default LinkImplant;
