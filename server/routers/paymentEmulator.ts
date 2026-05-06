import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// In-memory store (replace with DB in production)
const virtualCards = new Map();
const transactions = new Map();

export const paymentEmulatorRouter = router({
  // Create a virtual card that never expires
  createCard: protectedProcedure
    .input(
      z.object({
        cardholderName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cardId = uuidv4();
      const pan = generateLuhnValidPAN();
      const cvv = generateCVV();

      const virtualCard = {
        id: cardId,
        userId: ctx.user.id,
        cardholderName: input.cardholderName,
        pan,
        cvv,
        expiry: "07/30979", // Never expires
        balance: 0,
        status: "active",
        createdAt: new Date(),
        linkedPaymentMethod: null,
      };

      virtualCards.set(cardId, virtualCard);

      return {
        success: true,
        card: {
          id: cardId,
          pan,
          cvv,
          expiry: "07/30979",
          cardholderName: input.cardholderName,
          status: "active",
        },
      };
    }),

  // Get card details
  getCard: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(({ input, ctx }) => {
      const card = virtualCards.get(input.cardId);

      if (!card || card.userId !== ctx.user.id) {
        throw new Error("Card not found");
      }

      return {
        success: true,
        card: {
          id: card.id,
          pan: card.pan,
          cvv: card.cvv,
          expiry: card.expiry,
          cardholderName: card.cardholderName,
          balance: card.balance,
          status: card.status,
        },
      };
    }),

  // Link payment method to card
  linkPaymentMethod: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        paymentMethodId: z.string(),
        amount: z.number(),
      })
    )
    .mutation(({ input, ctx }) => {
      const card = virtualCards.get(input.cardId);

      if (!card || card.userId !== ctx.user.id) {
        throw new Error("Card not found");
      }

      card.linkedPaymentMethod = input.paymentMethodId;
      card.balance = input.amount;

      return {
        success: true,
        card: {
          id: input.cardId,
          balance: card.balance,
          linkedPaymentMethod: input.paymentMethodId,
        },
      };
    }),

  // Process a transaction
  processTransaction: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        amount: z.number(),
        merchant: z.string(),
        description: z.string(),
      })
    )
    .mutation(({ input, ctx }) => {
      const card = virtualCards.get(input.cardId);

      if (!card || card.userId !== ctx.user.id) {
        throw new Error("Card not found");
      }

      if (card.balance < input.amount) {
        throw new Error("Insufficient balance");
      }

      const transactionId = uuidv4();
      const transaction = {
        id: transactionId,
        cardId: input.cardId,
        amount: input.amount,
        merchant: input.merchant,
        description: input.description,
        status: "completed",
        timestamp: new Date(),
        authCode: generateAuthCode(),
      };

      transactions.set(transactionId, transaction);
      card.balance -= input.amount;

      return {
        success: true,
        transaction: {
          id: transactionId,
          amount: input.amount,
          merchant: input.merchant,
          status: "completed",
          authCode: transaction.authCode,
          timestamp: transaction.timestamp,
          newBalance: card.balance,
        },
      };
    }),

  // Get transaction history
  getTransactions: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(({ input, ctx }) => {
      const card = virtualCards.get(input.cardId);

      if (!card || card.userId !== ctx.user.id) {
        throw new Error("Card not found");
      }

      const cardTransactions = Array.from(transactions.values())
        .filter((t) => t.cardId === input.cardId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return {
        success: true,
        transactions: cardTransactions,
      };
    }),

  // Emulate card scan
  emulateCardScan: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        pin: z.string(),
      })
    )
    .mutation(({ input, ctx }) => {
      const card = virtualCards.get(input.cardId);

      if (!card || card.userId !== ctx.user.id) {
        throw new Error("Card not found");
      }

      // Verify PIN (default: 1234)
      if (input.pin !== "1234") {
        throw new Error("Invalid PIN");
      }

      const cardTransactions = Array.from(transactions.values()).filter(
        (t) => t.cardId === input.cardId
      );

      return {
        success: true,
        appletData: {
          aid: "A0000000045645415243 48",
          pan: card.pan,
          cvv: card.cvv,
          expiry: card.expiry,
          cardholderName: card.cardholderName,
          balance: card.balance,
          transactionCounter: cardTransactions.length,
          status: card.status,
        },
      };
    }),

  // Get all user's cards
  getMyCards: protectedProcedure.query(({ ctx }) => {
    const userCards = Array.from(virtualCards.values()).filter(
      (c) => c.userId === ctx.user.id
    );

    return {
      success: true,
      cards: userCards.map((c) => ({
        id: c.id,
        cardholderName: c.cardholderName,
        pan: c.pan,
        expiry: c.expiry,
        balance: c.balance,
        status: c.status,
        createdAt: c.createdAt,
      })),
    };
  }),
});

// Utility functions
function generateLuhnValidPAN() {
  const prefix = "453200";
  let digits = prefix;

  for (let i = 0; i < 9; i++) {
    digits += Math.floor(Math.random() * 10);
  }

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return digits + checksum;
}

function generateCVV() {
  return Math.floor(100 + Math.random() * 900).toString();
}

function generateAuthCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
