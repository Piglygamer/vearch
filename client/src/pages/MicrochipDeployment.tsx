import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MicrochipDeployment() {
  const [stripeCardId, setStripeCardId] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [pan, setPan] = useState("");
  const [cvv, setCvv] = useState("");
  const [expiry, setExpiry] = useState("");
  const [pin, setPin] = useState("1234");
  const [currentStep, setCurrentStep] = useState(1);
  const [deploymentCode, setDeploymentCode] = useState("");
  const [microchipId, setMicrochipId] = useState("");

  // tRPC queries and mutations
  const deployCardMutation = trpc.microchip.deployCard.useMutation();
  const getDeploymentPackageQuery = trpc.microchip.getDeploymentPackage.useQuery(
    {
      stripeCardId,
      cardholderName,
      pan,
      cvv,
      expiry,
    },
    { enabled: currentStep === 2 && !!stripeCardId }
  );
  const verifyDeploymentQuery = trpc.microchip.verifyDeployment.useQuery(
    {
      microchipId,
      deploymentCode,
    },
    { enabled: currentStep === 5 && !!microchipId && !!deploymentCode }
  );
  const getMicrochipStatusQuery = trpc.microchip.getMicrochipStatus.useQuery(
    { microchipId },
    { enabled: currentStep === 6 && !!microchipId }
  );
  const getInstructionsQuery = trpc.microchip.getDeploymentInstructions.useQuery();

  const handleDeployCard = async () => {
    try {
      const result = await deployCardMutation.mutateAsync({
        stripeCardId,
        cardholderName,
        pan,
        cvv,
        expiry,
        pin,
      });

      setMicrochipId(result.microchipId);
      setDeploymentCode(result.deploymentCode);
      setCurrentStep(4);
    } catch (error) {
      console.error("Error deploying card:", error);
    }
  };

  const handleVerifyDeployment = () => {
    if (verifyDeploymentQuery.data?.verified) {
      setCurrentStep(6);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500 mb-2">
            🔗 Microchip Deployment
          </h1>
          <p className="text-slate-400">
            Link your Stripe virtual card to your Apex Flex microchip for worldwide payments
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex justify-between items-center">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step <= currentStep
                    ? "bg-gradient-to-r from-pink-500 to-cyan-500 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {step}
              </div>
              {step < 6 && (
                <div
                  className={`w-12 h-1 mx-2 ${
                    step < currentStep
                      ? "bg-gradient-to-r from-pink-500 to-cyan-500"
                      : "bg-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Card Details */}
        {currentStep === 1 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 1: Stripe Card Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Stripe Card ID"
                value={stripeCardId}
                onChange={(e) => setStripeCardId(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="Cardholder Name"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="PAN (Card Number)"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Input
                placeholder="CVV"
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
                placeholder="PIN"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!stripeCardId || !cardholderName || !pan || !cvv || !expiry}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                Continue to Deployment Package
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Deployment Package */}
        {currentStep === 2 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 2: Deployment Package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getDeploymentPackageQuery.isLoading && (
                <p className="text-slate-400">Generating deployment package...</p>
              )}
              {getDeploymentPackageQuery.data && (
                <>
                  <Alert className="bg-slate-700 border-slate-600">
                    <AlertDescription className="text-cyan-400">
                      <div className="space-y-2">
                        <div>
                          <strong>Bytecode:</strong>
                          <div className="text-xs text-slate-300 break-all mt-1">
                            {getDeploymentPackageQuery.data.bytecode.substring(0, 100)}...
                          </div>
                        </div>
                        <div>
                          <strong>APDU Commands:</strong>
                          <div className="text-xs text-slate-300 mt-1">
                            {getDeploymentPackageQuery.data.apdus.length} commands
                          </div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={() => setCurrentStep(3)}
                    className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
                  >
                    Continue to Deployment
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Connect Microchip */}
        {currentStep === 3 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 3: Connect Microchip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-slate-700 border-slate-600">
                <AlertDescription className="text-slate-300">
                  <div className="space-y-2">
                    <p>1. Connect your Apex Flex microchip to a card reader</p>
                    <p>2. Ensure the reader is compatible with Java Card applets</p>
                    <p>3. Verify the connection is secure</p>
                    <p>4. Click "Deploy Applet" when ready</p>
                  </div>
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleDeployCard}
                disabled={deployCardMutation.isPending}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                {deployCardMutation.isPending ? "Deploying..." : "Deploy Applet to Microchip"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Deployment Code */}
        {currentStep === 4 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 4: Deployment Successful</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-green-900 border-green-700">
                <AlertDescription className="text-green-300">
                  <div className="space-y-2">
                    <div>
                      <strong>Microchip ID:</strong> {microchipId}
                    </div>
                    <div>
                      <strong>Deployment Code:</strong> {deploymentCode}
                    </div>
                    <p className="mt-4 text-sm">Save these details for verification</p>
                  </div>
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => setCurrentStep(5)}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
              >
                Continue to Verification
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Verify Deployment */}
        {currentStep === 5 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">Step 5: Verify Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {verifyDeploymentQuery.isLoading && (
                <p className="text-slate-400">Verifying deployment...</p>
              )}
              {verifyDeploymentQuery.data && (
                <>
                  <Alert
                    className={
                      verifyDeploymentQuery.data.verified
                        ? "bg-green-900 border-green-700"
                        : "bg-red-900 border-red-700"
                    }
                  >
                    <AlertDescription
                      className={
                        verifyDeploymentQuery.data.verified
                          ? "text-green-300"
                          : "text-red-300"
                      }
                    >
                      {verifyDeploymentQuery.data.message}
                    </AlertDescription>
                  </Alert>
                  {verifyDeploymentQuery.data.verified && (
                    <Button
                      onClick={handleVerifyDeployment}
                      className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
                    >
                      Continue to Status
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 6: Ready for Payments */}
        {currentStep === 6 && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">✅ Ready for Worldwide Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getMicrochipStatusQuery.data && (
                <Alert className="bg-green-900 border-green-700">
                  <AlertDescription className="text-green-300">
                    <div className="space-y-2">
                      <div>
                        <strong>Status:</strong> {getMicrochipStatusQuery.data.status}
                      </div>
                      <div>
                        <strong>Transactions:</strong> {getMicrochipStatusQuery.data.transactionCount}
                      </div>
                      <div>
                        <strong>Balance:</strong> ${getMicrochipStatusQuery.data.balance.toFixed(2)}
                      </div>
                      <p className="mt-4 text-sm">
                        Your microchip is now ready to process payments at any terminal worldwide. Simply
                        scan your Apex Flex implant to pay.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {getInstructionsQuery.data && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">📋 Deployment Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getInstructionsQuery.data.instructions.map((instruction) => (
                  <div key={instruction.step} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-full flex items-center justify-center font-bold text-white">
                      {instruction.step}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">{instruction.title}</div>
                      <div className="text-sm text-slate-400">{instruction.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
