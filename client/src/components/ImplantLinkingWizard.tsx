import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Smartphone, CheckCircle, Zap, Radio } from "lucide-react";

interface ImplantLinkingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "intro" | "nfc-scan" | "verify" | "deploy" | "complete";

export function ImplantLinkingWizard({ open, onOpenChange, onSuccess }: ImplantLinkingWizardProps) {
  const [step, setStep] = useState<Step>("intro");
  const [implantId, setImplantId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(true);

  const startNFCScan = async () => {
    setIsScanning(true);
    setError(null);

    try {
      // Check if Web NFC is supported
      if (!("NDEFReader" in window)) {
        setNfcSupported(false);
        setError("NFC is not supported on this device. Please use a device with NFC capability.");
        setIsScanning(false);
        return;
      }

      const ndef = new (window as any).NDEFReader();
      
      // Start scanning
      await ndef.scan();

      ndef.onreading = (event: any) => {
        const { message } = event;
        
        // Extract implant ID from NFC data
        let scannedId = null;
        for (const record of message.records) {
          if (record.recordType === "text") {
            const decoder = new TextDecoder();
            scannedId = decoder.decode(record.data);
            break;
          }
        }

        if (scannedId) {
          setImplantId(scannedId);
          setStep("verify");
        } else {
          setError("No implant ID found on this NFC tag");
        }
        setIsScanning(false);
      };

      ndef.onerror = () => {
        setError("Failed to read NFC tag. Please try again.");
        setIsScanning(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFC scan failed");
      setIsScanning(false);
    }
  };

  const deployApplet = async () => {
    if (!implantId) return;

    setIsDeploying(true);
    setError(null);

    try {
      const res = await fetch("/api/applet/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          implantId,
          appletType: "payment",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep("complete");
      } else {
        setError(data.error || "Applet deployment failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleClose = () => {
    if (step === "complete") {
      onSuccess();
      onOpenChange(false);
      setStep("intro");
      setImplantId(null);
      setError(null);
    } else {
      onOpenChange(false);
      setStep("intro");
      setImplantId(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link Your Implant</DialogTitle>
          <DialogDescription>
            Connect your Apex Flex implant to enable tap-to-pay transactions
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Introduction */}
        {step === "intro" && (
          <div className="space-y-4">
            <Card className="border-magenta-500/30 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-magenta-500" />
                  Step 1: Prepare Your Device
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Ensure NFC is enabled on your device</p>
                <p>✓ Have your Apex Flex implant ready</p>
                <p>✓ Keep your implant close to your device</p>
              </CardContent>
            </Card>

            <Button
              onClick={() => setStep("nfc-scan")}
              className="w-full bg-magenta-600 hover:bg-magenta-700"
            >
              Continue to NFC Scan
            </Button>
          </div>
        )}

        {/* Step 2: NFC Scan */}
        {step === "nfc-scan" && (
          <div className="space-y-4">
            <Card className="border-cyan-500/30 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-500 animate-pulse" />
                  Step 2: Scan Your Implant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hold your Apex Flex implant near the back of your device. The scan will start automatically.
                </p>

                <div className="flex justify-center py-8">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 border-2 border-cyan-500 rounded-lg animate-pulse" />
                    <div className="absolute inset-2 border border-cyan-500/50 rounded-lg" />
                    <Smartphone className="absolute inset-0 m-auto w-12 h-12 text-cyan-500" />
                  </div>
                </div>

                <Button
                  onClick={startNFCScan}
                  disabled={isScanning}
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                >
                  {isScanning ? "Scanning... Hold implant near device" : "Start NFC Scan"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Verify */}
        {step === "verify" && implantId && (
          <div className="space-y-4">
            <Card className="border-green-500/30 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Step 3: Verify Implant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-background/50 border border-border rounded-md p-4">
                  <p className="text-sm text-muted-foreground mb-2">Implant ID</p>
                  <p className="text-lg font-mono text-cyan-400">{implantId}</p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Your implant has been detected. Click "Deploy Applet" to install the payment application.
                </p>

                <Button
                  onClick={deployApplet}
                  disabled={isDeploying}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isDeploying ? "Deploying..." : "Deploy Payment Applet"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <div className="space-y-4">
            <Card className="border-green-500/30 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Implant Linked Successfully!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-background/50 border border-green-500/30 rounded-md p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">✓ Implant ID: {implantId}</p>
                  <p className="text-sm text-muted-foreground">✓ Payment applet deployed</p>
                  <p className="text-sm text-muted-foreground">✓ Ready for tap-to-pay</p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Your Apex Flex implant is now linked to your Vearch Bank account. You can use tap-to-pay for transactions.
                </p>

                <Button
                  onClick={handleClose}
                  className="w-full bg-magenta-600 hover:bg-magenta-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Done
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
