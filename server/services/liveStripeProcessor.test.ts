import { describe, it, expect, beforeAll, vi } from 'vitest';
import { processLiveStripeCharge, getChargeStatus } from './liveStripeProcessor';

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    customers: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        latest_charge: 'ch_test123',
        amount: 5000,
        currency: 'usd',
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        latest_charge: 'ch_test123',
        amount: 5000,
        currency: 'usd',
      }),
    },
  })),
}));

// Mock database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        stripeCustomerId: null,
      },
    ]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
  }),
}));

describe('Live Stripe Processor', () => {
  describe('processLiveStripeCharge', () => {
    it('should process a real Stripe charge', async () => {
      const result = await processLiveStripeCharge({
        userId: 1,
        amount: 50,
        description: 'Test charge',
        paymentMethodId: 'pm_test123',
      });

      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_test123');
      expect(result.chargeId).toBe('ch_test123');
      expect(result.amount).toBe(50);
    });

    it('should handle charge failures gracefully', async () => {
      const result = await processLiveStripeCharge({
        userId: 999,
        amount: 50,
        description: 'Test charge',
        paymentMethodId: 'pm_invalid',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });
  });

  describe('getChargeStatus', () => {
    it('should retrieve charge status', async () => {
      const result = await getChargeStatus('pi_test123');

      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(50);
      expect(result.currency).toBe('USD');
      expect(result.succeeded).toBe(true);
    });
  });
});
