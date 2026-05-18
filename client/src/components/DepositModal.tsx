/**
 * REAL Deposit Modal
 * 
 * This uses the REAL RealDepositFlow component with actual Stripe card collection.
 * NOT simulated.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RealDepositFlow } from "./RealDepositFlow";
import { Elements } from "@stripe/react-stripe-js";
import { useAuth } from "@/_core/hooks/useAuth";

// Stripe is already loaded via CDN in index.html
const stripePromise = (window as any).Stripe
  ? Promise.resolve((window as any).Stripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY || ""))
  : Promise.reject(new Error("Stripe not loaded"));

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DepositModal({
  open,
  onOpenChange,
  onSuccess,
}: DepositModalProps) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleDepositSuccess = (transactionId: string, amount: number) => {
    setError(null);
    onOpenChange(false);
    onSuccess();
  };

  const handleDepositError = (error: string) => {
    setError(error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-amber-500/30">
        <DialogHeader>
          <DialogTitle className="text-white">Add Money to Wallet</DialogTitle>
          <DialogDescription className="text-slate-400">
            Deposit funds using a real credit or debit card
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Stripe Elements Provider with REAL Deposit Flow */}
        {user && stripePromise && (
          <Elements stripe={stripePromise}>
            <RealDepositFlow
              userId={user.id}
              onSuccess={handleDepositSuccess}
              onError={handleDepositError}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
