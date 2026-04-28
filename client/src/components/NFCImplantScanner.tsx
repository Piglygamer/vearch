import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Zap } from "lucide-react";

interface NFCImplantScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (implantId: string) => void;
}

export function NFCImplantScanner({ open, onOpenChange, onSuccess }: NFCImplantScannerProps) {
  const [implantId, setImplantId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);

  useEffect(() => {
    // Check if Web NFC API is supported
    if ("NDEFReader" in window) {
      setNfcSupported(true);
    }
  }, []);

  const handleNFCScan = async () => {
    if (!nfcSupported) {
      setError("NFC is not supported on this device. Please enter implant ID manually.");
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();

      ndef.onreading = (event: any) => {
        const message = event.message;
        if (message.records.length > 0) {
          const record = message.records[0];
          const decoder = new TextDecoder();
          const implantData = decoder.decode(record.data);
          setImplantId(implantData);
          setIsScanning(false);
        }
      };

      ndef.onreadingerror = () => {
        setError("Failed to read NFC tag. Please try again.");
        setIsScanning(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFC scan failed");
      setIsScanning(false);
    }
  };

  const handleLinkImplant = async () => {
    if (!implantId) {
      setError("Please enter or scan an implant ID");
      return;
    }

    try {
      const res = await fetch("/api/implants/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ implantId }),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess(implantId);
        setImplantId("");
        onOpenChange(false);
      } else {
        setError(data.error || "Failed to link implant");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-magenta-500" />
            Link NFC Implant
          </DialogTitle>
          <DialogDescription>
            Scan your Apex Flex implant or enter the implant ID manually
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {nfcSupported && (
            <Button
              onClick={handleNFCScan}
              disabled={isScanning}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {isScanning ? "Scanning NFC..." : "Scan Implant"}
            </Button>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
            </div>
          </div>

          <div>
            <Label htmlFor="implant-id">Implant ID</Label>
            <Input
              id="implant-id"
              placeholder="e.g., APEX-FLEX-001"
              value={implantId}
              onChange={(e) => setImplantId(e.target.value)}
            />
          </div>

          <Button
            onClick={handleLinkImplant}
            className="w-full bg-magenta-600 hover:bg-magenta-700"
          >
            Link Implant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
