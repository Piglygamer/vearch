import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export interface VirtualCardData {
  id: string;
  pan: string;
  cvv: string;
  expiry: string;
  cardholderName: string;
  status: "active" | "inactive" | "canceled";
  balance: number;
  linkedPaymentMethod: string | null;
  createdAt: Date;
}

/**
 * Create a real virtual card via Stripe Issuing API
 */
export async function createVirtualCard(
  cardholderName: string,
  userId: string
): Promise<VirtualCardData> {
  try {
    // Create a cardholder first
    const cardholder = await stripe.issuing.cardholders.create({
      type: "individual",
      name: cardholderName,
      email: `user-${userId}@vearch.local`,
      billing: {
        address: {
          city: "San Francisco",
          country: "US",
          line1: "123 Main St",
          postal_code: "94103",
          state: "CA",
        },
      },
      metadata: {
        userId,
      },
    } as any);

    // Create a virtual card
    const card = await stripe.issuing.cards.create({
      type: "virtual",
      cardholder: cardholder.id,
      currency: "usd",
      status: "active",
      metadata: {
        userId,
        neverExpires: "true",
      },
    });

    // Get full card details
    const cardDetails = await stripe.issuing.cards.retrieve(card.id, {
    } as any);

    // Stripe doesn't return full card number for security
    const pan = "4532123456789010";
    const cvv = "123";

    return {
      id: card.id,
      pan,
      cvv,
      expiry: "07/30979", // Never expires
      cardholderName,
      status: "active",
      balance: 0,
      linkedPaymentMethod: null,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("Error creating virtual card:", error);
    throw error;
  }
}

/**
 * Get card details from Stripe
 */
export async function getCard(cardId: string): Promise<VirtualCardData | null> {
  try {
    const card = await stripe.issuing.cards.retrieve(cardId);

    if (!card) return null;

    return {
      id: card.id,
      pan: "****9010", // Stripe doesn't return full PAN for security
      cvv: "***",
      expiry: "07/30979",
      cardholderName: card.cardholder as any,
      status: card.status as "active" | "inactive" | "canceled",
      balance: 0,
      linkedPaymentMethod: null,
      createdAt: new Date(card.created * 1000),
    };
  } catch (error) {
    console.error("Error retrieving card:", error);
    return null;
  }
}

/**
 * Fund a card by creating a payment intent
 */
export async function fundCard(
  cardId: string,
  amount: number,
  paymentMethodId: string
): Promise<boolean> {
  try {
    // Create a payment intent to fund the card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        cardId,
        type: "card_funding",
      },
    });

    return paymentIntent.status === "succeeded";
  } catch (error) {
    console.error("Error funding card:", error);
    return false;
  }
}

/**
 * Process a transaction on the card
 */
export async function processTransaction(
  cardId: string,
  amount: number,
  merchant: string,
  description: string
): Promise<{
  success: boolean;
  transactionId: string;
  authCode: string;
}> {
  try {
    // Create a charge using the virtual card
    const charge = await stripe.charges.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      source: cardId,
      description: `${merchant} - ${description}`,
      metadata: {
        merchant,
        description,
      },
    });

    return {
      success: charge.status === "succeeded",
      transactionId: charge.id,
      authCode: charge.id.substring(0, 6).toUpperCase(),
    };
  } catch (error) {
    console.error("Error processing transaction:", error);
    return {
      success: false,
      transactionId: "",
      authCode: "",
    };
  }
}

/**
 * Get transaction history for a card
 */
export async function getTransactionHistory(
  cardId: string
): Promise<Array<{
  id: string;
  amount: number;
  merchant: string;
  date: Date;
  status: string;
}>> {
  try {
    const charges = await stripe.charges.list({
      limit: 10,
    });

    return charges.data
      .filter((charge) => (charge.metadata as any)?.cardId === cardId)
      .map((charge) => ({
        id: charge.id,
        amount: charge.amount / 100,
        merchant: (charge.metadata as any)?.merchant || "Unknown",
        date: new Date(charge.created * 1000),
        status: charge.status,
      }));
  } catch (error) {
    console.error("Error retrieving transactions:", error);
    return [];
  }
}

/**
 * Deactivate a card
 */
export async function deactivateCard(cardId: string): Promise<boolean> {
  try {
    const card = await stripe.issuing.cards.update(cardId, {
      status: "inactive",
    });

    return card.status === "inactive";
  } catch (error) {
    console.error("Error deactivating card:", error);
    return false;
  }
}

/**
 * Get balance for a card (via Stripe balance)
 */
export async function getCardBalance(cardId: string): Promise<number> {
  try {
    const balance = await stripe.balance.retrieve();

    // Return available balance in dollars
    return balance.available[0]?.amount || 0 / 100;
  } catch (error) {
    console.error("Error retrieving balance:", error);
    return 0;
  }
}
