import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MicrochipDeployment() {
  const [pan, setPan] = useState("4532123456789010");
  const [cvv, setCvv] = useState("123");
  const [expiry, setExpiry] = useState("12/28");
  const [cardholderName, setCardholderName] = useState("VEARCH USER");
  const [pinHash, setPinHash] = useState("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const [currentStep, setCurrentStep] = useState(1);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);

  const generateAppletMutation = trpc.microchip.generateApplet.useMutation();
  const createDeploymentMutation = trpc.microchip.createDeploymentPackage.useMutation();
  const getCompatibilityQuery = trpc.microchip.getTerminalCompatibility.useQuery();

  const handleGenerateApplet = async () => {
    try {
      const result = await generateAppletMutation.mutateAsync({
        pan,
        cvv,
        expiry,
        cardholderName,
        pinHash,
      });
      setDeploymentResult(result);
      setCurrentStep(2);
    } catch (error) {
      console.error("Error generating applet:", error);
    }
  };

  const handleCreateDeployment = async () => {
    try {
      const result = await createDeploymentMutation.mutateAsync({
        pan,
        cvv,
        expiry,
        cardholderName,
        pinHash,
      });
      setDeploymentResult(result);
      setCurrentStep(3);
    } catch (error) {
      console.error("Error creating deployment:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500 mb-8">
          🔗 Deploy to Apex Flex
        </h1>

        {/* Step 1: Card Details */}
        {currentStep === 1 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 1: Card Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="PAN (16 digits)"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="CVV (3 digits)"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="Expiry (MM/YY)"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="Cardholder Name"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={handleGenerateApplet}
                disabled={generateAppletMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {generateAppletMutation.isPending ? "Generating..." : "Generate Applet"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Applet Generated */}
        {currentStep === 2 && deploymentResult && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 2: Applet Generated</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-900 border-green-700">
                <AlertDescription className="text-green-300">
                  <div className="space-y-2">
                    <p>✓ Applet ID: {deploymentResult.appletId}</p>
                    <p>✓ Size: {deploymentResult.size} bytes</p>
                    <p>✓ Ready for deployment</p>
                  </div>
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleCreateDeployment}
                disabled={createDeploymentMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {createDeploymentMutation.isPending ? "Creating..." : "Create Deployment Package"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Deployment Ready */}
        {currentStep === 3 && deploymentResult && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 3: Ready for Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-900 border-green-700">
                <AlertDescription className="text-green-300">
                  <div className="space-y-2">
                    <p>✓ Applet ID: {deploymentResult.package?.appletId}</p>
                    <p>✓ Verified: {deploymentResult.verified ? "Yes" : "No"}</p>
                    <p>✓ Ready to deploy to Apex Flex</p>
                  </div>
                </AlertDescription>
              </Alert>

              {getCompatibilityQuery.data && (
                <Alert className="bg-slate-700 border-slate-600">
                  <AlertDescription className="text-cyan-300">
                    <p>Terminal Compatibility: {getCompatibilityQuery.data.compatibility}%</p>
                    <p className="text-sm text-slate-400 mt-2">
                      This applet works with {getCompatibilityQuery.data.supportedTerminals?.length || 0} terminal types worldwide
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => setCurrentStep(1)}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                Deploy Another Card
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
