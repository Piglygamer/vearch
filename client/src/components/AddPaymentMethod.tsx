/**
 * Middleman bridge: add a real card to the user's Stripe Customer.
 *
 * Flow:
 *   1. Ask the server for a SetupIntent client secret.
 *   2. Mount Stripe's <PaymentElement /> bound to that secret.
 *   3. Confirm the SetupIntent — Stripe attaches the resulting `pm_…` to the
 *      user's Stripe Customer. The PAN never crosses our backend.
 *
 * The new PaymentMethod is mirrored into our local `paymentMethods` table by
 * the `payment_method.attached` webhook handler.
 */

import { useState } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface AddPaymentMethodProps {
  /** Called once Stripe confirms the SetupIntent successfully. */
  onSuccess?: () => void;
}

/**
 * The form rendered inside an <Elements clientSecret=…/> provider.
 * It needs to be a child of <Elements/> so the hooks resolve correctly.
 */
function PaymentMethodForm({ onSuccess }: AddPaymentMethodProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? "Failed to save card");
      return;
    }
    setDone(true);
    onSuccess?.();
  }

  if (done) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>Card saved. It will appear in your list shortly.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save card"}
      </Button>
    </form>
  );
}

/**
 * Top-level component. Creates a SetupIntent and mounts <Elements/> bound to
 * it. We re-create the inner <Elements> here (rather than relying on the
 * top-level provider in `main.tsx`) because each SetupIntent needs its own
 * clientSecret on the Elements options.
 */
export function AddPaymentMethod({ onSuccess }: AddPaymentMethodProps) {
  const setupIntent = trpc.paymentMethods.createSetupIntent.useMutation();
  const [stripePromise] = useState<Promise<Stripe | null>>(() => {
    const key =
      (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) || "";
    return key ? loadStripe(key) : Promise.resolve(null);
  });

  if (!setupIntent.data && !setupIntent.isPending) {
    return (
      <Button onClick={() => setupIntent.mutate()} className="w-full">
        Add a card
      </Button>
    );
  }

  if (setupIntent.isPending || !setupIntent.data) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: setupIntent.data.clientSecret }}
    >
      <PaymentMethodForm onSuccess={onSuccess} />
    </Elements>
  );
}

export default AddPaymentMethod;
