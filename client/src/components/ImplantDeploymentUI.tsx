/**
 * Implant Deployment UI
 * 
 * Allows users to deploy EMV applets to their Apex Flex implants via Fidesmo
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ImplantDeploymentUIProps {
  implantId: number;
  implantType: string;
  implantUid: string;
  onDeploymentComplete: () => void;
}

export function ImplantDeploymentUI({
  implantId,
  implantType,
  implantUid,
  onDeploymentComplete,
}: ImplantDeploymentUIProps) {
  const [deploymentStep, setDeploymentStep] = useState<"idle" | "deploying" | "success" | "error">("idle");
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);

  // Real Fidesmo deployment mutation
  const deployApplet = trpc.fidesmoDeployment.deployToImplant.useMutation();

  const handleDeploy = async () => {
    try {
      setDeploymentStep("deploying");
      setDeploymentError(null);

      // Call backend to deploy applet
      const result = await deployApplet.mutateAsync({
        implantId,
        implantUid,
        implantType,
      });

      if (result.success) {
        setDeploymentStep("success");
        setDeploymentUrl(result.deploymentUrl || null);
        toast.success("Applet deployment initiated! Check your Fidesmo app.");
        onDeploymentComplete();
      } else {
        throw new Error(result.error || "Deployment failed");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Deployment failed";
      setDeploymentStep("error");
      setDeploymentError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <Card className="border-magenta/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-magenta" />
          Deploy EMV Applet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Implant Info */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Implant Type</p>
          <p className="font-medium">{implantType}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">UID: {implantUid}</p>
        </div>

        {/* Status */}
        {deploymentStep === "idle" && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-200 text-sm">
              Ready to deploy EMV applet to your implant. This will enable tap-to-pay at any NFC terminal.
            </p>
          </div>
        )}

        {deploymentStep === "deploying" && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-2">
            <Loader className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5 animate-spin" />
            <p className="text-yellow-200 text-sm">Deploying applet to your implant...</p>
          </div>
        )}

        {deploymentStep === "success" && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-200 text-sm font-medium">Deployment Successful!</p>
              <p className="text-green-200 text-xs mt-1">
                Your implant now has the EMV applet. You can tap at any NFC terminal to pay.
              </p>
              {deploymentUrl && (
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-300 text-xs underline mt-1 inline-block"
                >
                  Open Fidesmo App →
                </a>
              )}
            </div>
          </div>
        )}

        {deploymentStep === "error" && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{deploymentError}</p>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleDeploy}
          disabled={deploymentStep !== "idle" && deploymentStep !== "error"}
          className="w-full bg-magenta hover:bg-magenta-dark text-white"
        >
          {deploymentStep === "deploying" && (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Deploying...
            </>
          )}
          {deploymentStep === "success" && (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Deployment Complete
            </>
          )}
          {(deploymentStep === "idle" || deploymentStep === "error") && (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Deploy Applet Now
            </>
          )}
        </Button>

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          Deployment via Fidesmo takes 2-5 minutes. Keep your implant near your NFC reader during the process.
        </p>
      </CardContent>
    </Card>
  );
}
