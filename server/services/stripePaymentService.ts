import Stripe from "stripe";

let stripe: any = null;

try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.warn("[Stripe Payment] Failed to initialize Stripe client.");
}

/**
 * Stripe Payment Service: Handles real payment methods, deposits, and withdrawals
 */

/**
 * Create a payment intent for deposit
 */
export async function createDepositIntent(
  stripeAccountId: string,
  amount: number,
  currency: string = "usd"
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        payment_method_types: ["card"],
        metadata: {
          type: "deposit",
        },
      },
      { stripeAccount: stripeAccountId }
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error("[Stripe Payment] Deposit intent creation failed:", error);
    throw error;
  }
}

/**
 * Confirm payment intent (after user enters card details)
 */
export async function confirmPaymentIntent(
  stripeAccountId: string,
  paymentIntentId: string,
  paymentMethodId: string
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.confirm(
      paymentIntentId,
      {
        payment_method: paymentMethodId,
      },
      { stripeAccount: stripeAccountId }
    );

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      succeeded: paymentIntent.status === "succeeded",
    };
  } catch (error) {
    console.error("[Stripe Payment] Payment confirmation failed:", error);
    throw error;
  }
}

/**
 * List available payment methods for a customer
 */
export async function listPaymentMethods(
  stripeAccountId: string,
  customerId: string
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list(
      {
        customer: customerId,
        type: "card",
      },
      { stripeAccount: stripeAccountId }
    );

    return paymentMethods.data.map((pm: any) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === paymentMethods.data[0]?.id,
    }));
  } catch (error) {
    console.error("[Stripe Payment] Payment methods list failed:", error);
    throw error;
  }
}

/**
 * Create a payout (withdrawal) to a bank account
 */
export async function createPayout(
  stripeAccountId: string,
  amount: number,
  bankAccountId: string,
  currency: string = "usd"
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        destination: bankAccountId,
        metadata: {
          type: "withdrawal",
        },
      },
      { stripeAccount: stripeAccountId }
    );

    return {
      payoutId: payout.id,
      amount: payout.amount / 100,
      status: payout.status,
      arrivalDate: payout.arrival_date,
    };
  } catch (error) {
    console.error("[Stripe Payment] Payout creation failed:", error);
    throw error;
  }
}

/**
 * List bank accounts for a customer
 */
export async function listBankAccounts(
  stripeAccountId: string,
  customerId: string
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const bankAccounts = await stripe.customers.listBankAccounts(
      customerId,
      {},
      { stripeAccount: stripeAccountId }
    );

    return bankAccounts.data.map((ba: any) => ({
      id: ba.id,
      bankName: ba.bank_name,
      accountHolderName: ba.account_holder_name,
      last4: ba.last4,
      routingNumber: ba.routing_number,
      isDefault: ba.id === bankAccounts.data[0]?.id,
    }));
  } catch (error) {
    console.error("[Stripe Payment] Bank accounts list failed:", error);
    throw error;
  }
}

/**
 * Get account balance
 */
export async function getAccountBalance(stripeAccountId: string) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId }
    );

    const available = balance.available[0]?.amount || 0;
    return available / 100; // Convert from cents
  } catch (error) {
    console.error("[Stripe Payment] Balance retrieval failed:", error);
    throw error;
  }
}

/**
 * Create a test payment method for development
 */
export async function createTestPaymentMethod(
  stripeAccountId: string,
  cardNumber: string = "4242424242424242",
  expMonth: number = 12,
  expYear: number = 2030,
  cvc: string = "314"
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const paymentMethod = await stripe.paymentMethods.create(
      {
        type: "card",
        card: {
          number: cardNumber,
          exp_month: expMonth,
          exp_year: expYear,
          cvc,
        },
      },
      { stripeAccount: stripeAccountId }
    );

    return {
      id: paymentMethod.id,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
    };
  } catch (error) {
    console.error("[Stripe Payment] Test payment method creation failed:", error);
    throw error;
  }
}

/**
 * Attach payment method to customer
 */
export async function attachPaymentMethod(
  stripeAccountId: string,
  paymentMethodId: string,
  customerId: string
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const paymentMethod = await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId },
      { stripeAccount: stripeAccountId }
    );

    return {
      id: paymentMethod.id,
      attached: true,
    };
  } catch (error) {
    console.error("[Stripe Payment] Payment method attachment failed:", error);
    throw error;
  }
}

/**
 * Get payment intent details
 */
export async function getPaymentIntent(
  stripeAccountId: string,
  paymentIntentId: string
) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      { stripeAccount: stripeAccountId }
    );

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error("[Stripe Payment] Payment intent retrieval failed:", error);
    throw error;
  }
}
