import Stripe from 'stripe';
import { getDb } from '../db';
import { transactions, wallets, users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export interface LiveStripeCharge {
  id: string;
  userId: number;
  amount: number;
  currency: string;
  status: 'succeeded' | 'processing' | 'failed' | 'pending';
  paymentIntentId: string;
  chargeId: string;
  description: string;
  createdAt: Date;
}

/**
 * Process a REAL Stripe charge (live payment)
 */
export async function processLiveStripeCharge(input: {
  userId: number;
  amount: number;
  currency?: string;
  description: string;
  paymentMethodId: string;
}): Promise<{
  success: boolean;
  chargeId: string;
  paymentIntentId: string;
  status: string;
  amount: number;
  message: string;
}> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        chargeId: '',
        paymentIntentId: '',
        status: 'failed',
        amount: 0,
        message: 'Database unavailable',
      };
    }

    // Get user
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (userList.length === 0) {
      return {
        success: false,
        chargeId: '',
        paymentIntentId: '',
        status: 'failed',
        amount: 0,
        message: 'User not found',
      };
    }

    const user = userList[0];
    const currency = input.currency || 'USD';

    // Get or create Stripe customer
    let customerId: string;
    if (user.stripeCustomerId) {
      customerId = user.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email || `user_${input.userId}@vearch.bank`,
        name: user.name || `Vearch User ${input.userId}`,
        metadata: {
          userId: input.userId.toString(),
        },
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, input.userId));
    }

    // Create payment intent with real charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method: input.paymentMethodId,
      off_session: true,
      confirm: true,
      description: input.description,
      metadata: {
        userId: input.userId.toString(),
      },
    });

    // Retrieve charge details
    const chargeId = paymentIntent.latest_charge as string || '';

    // Log transaction to database
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, input.userId))
      .limit(1);

    if (wallet.length > 0) {
      const newBalance = (
        parseFloat(wallet[0].balance.toString()) + input.amount
      ).toFixed(2);

      await db
        .update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, wallet[0].id));

      await db.insert(transactions).values({
        userId: input.userId,
        walletId: wallet[0].id,
        transactionType: 'topup',
        amount: input.amount.toString(),
        currency,
        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        description: input.description,
        stripePaymentIntentId: paymentIntent.id,
        metadata: JSON.stringify({
          chargeId,
        }),
      });
    }

    return {
      success: paymentIntent.status === 'succeeded',
      chargeId,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: input.amount,
      message:
        paymentIntent.status === 'succeeded'
          ? `Charge successful: $${input.amount}`
          : `Charge pending: ${paymentIntent.status}`,
    };
  } catch (error) {
    console.error('[LiveStripe] Charge error:', error);
    return {
      success: false,
      chargeId: '',
      paymentIntentId: '',
      status: 'failed',
      amount: 0,
      message: `Charge failed: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

export async function getChargeStatus(paymentIntentId: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  succeeded: boolean;
}> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      succeeded: paymentIntent.status === 'succeeded',
    };
  } catch (error) {
    return {
      status: 'error',
      amount: 0,
      currency: 'USD',
      succeeded: false,
    };
  }
}
