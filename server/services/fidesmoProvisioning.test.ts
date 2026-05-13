import { describe, it, expect, vi } from 'vitest';
import {
  provisionImplantChip,
  getProvisioningStatus,
  updateApplet,
  getAvailableApplets,
} from './fidesmoProvisioning';

// Mock database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Fidesmo NFC Provisioning', () => {
  describe('provisionImplantChip', () => {
    it('should provision a real NFC chip', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          provisioningId: 'prov_123',
          status: 'provisioned',
        }),
      });

      const result = await provisionImplantChip({
        userId: 1,
        implantId: 'impl_123',
        nfcChipId: 'chip_abc123',
        appletId: 'vearch_payment_v1',
        walletId: 1,
        cardToken: 'tok_visa',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('provisioned');
    });

    it('should handle provisioning failures', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid chip ID',
      });

      const result = await provisionImplantChip({
        userId: 1,
        implantId: 'impl_123',
        nfcChipId: 'chip_invalid',
        appletId: 'vearch_payment_v1',
        walletId: 1,
        cardToken: 'tok_visa',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('getProvisioningStatus', () => {
    it('should retrieve provisioning status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'provisioned',
          message: 'Chip provisioned successfully',
        }),
      });

      const result = await getProvisioningStatus('prov_123');

      expect(result.status).toBe('provisioned');
      expect(result.message).toBe('Chip provisioned successfully');
    });
  });

  describe('updateApplet', () => {
    it('should update applet on provisioned chip', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await updateApplet('chip_abc123', 'vearch_payment_v2');

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated');
    });
  });

  describe('getAvailableApplets', () => {
    it('should list available production applets', () => {
      const applets = getAvailableApplets();

      expect(applets.length).toBeGreaterThan(0);
      expect(applets[0].appletId).toBeDefined();
      expect(applets[0].name).toBeDefined();
      expect(applets[0].version).toBeDefined();
    });

    it('should include payment applet v1', () => {
      const applets = getAvailableApplets();
      const v1 = applets.find((a) => a.appletId === 'vearch_payment_v1');

      expect(v1).toBeDefined();
      expect(v1?.name).toContain('Payment');
    });

    it('should include payment applet v2 with biometric support', () => {
      const applets = getAvailableApplets();
      const v2 = applets.find((a) => a.appletId === 'vearch_payment_v2');

      expect(v2).toBeDefined();
      expect(v2?.permissions).toContain('biometric');
    });
  });
});
