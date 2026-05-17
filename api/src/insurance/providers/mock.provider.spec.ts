import { MockInsuranceProvider } from './mock.provider';

describe('MockInsuranceProvider', () => {
  let provider: MockInsuranceProvider;

  beforeEach(() => {
    provider = new MockInsuranceProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('has providerKey "mock"', () => {
    expect(provider.providerKey).toBe('mock');
  });

  describe('getQuote', () => {
    const baseParams = {
      declared_value: 100000,
      pickup_city: 'Buenos Aires',
      dropoff_city: 'Córdoba',
    };

    it('uses the correct rate for a known cargo type', async () => {
      const result = await provider.getQuote({ ...baseParams, cargo_type: 'electrodomesticos' });
      // rate = 0.025, no distance → premium = 100000 * 0.025 * 1 = 2500
      expect(result.premium).toBe(2500);
      expect(result.coverage_amount).toBe(100000);
      expect(result.coverage_days).toBe(30);
      expect(result.provider_name).toBe('CargaBack Seguros');
      expect(result.quote_id).toBeDefined();
      expect(result.details).toHaveLength(4);
    });

    it('uses the default rate (0.015) for an unknown cargo type', async () => {
      const result = await provider.getQuote({ ...baseParams, cargo_type: 'desconocido' });
      // rate = 0.015, premium = 100000 * 0.015 * 1 = 1500
      expect(result.premium).toBe(1500);
    });

    it('applies distance factor when distance_km is provided', async () => {
      const result = await provider.getQuote({ ...baseParams, cargo_type: 'granos', distance_km: 2000 });
      // rate = 0.008, distanceFactor = 1 + 2000/20000 = 1.1
      // premium = round(100000 * 0.008 * 1.1) = round(880) = 880
      expect(result.premium).toBe(880);
    });

    it('uses distanceFactor of 1 when distance_km is not provided', async () => {
      const result = await provider.getQuote({ ...baseParams, cargo_type: 'granos' });
      // rate = 0.008, premium = 100000 * 0.008 * 1 = 800
      expect(result.premium).toBe(800);
    });

    it('covers all known cargo types in rate table', async () => {
      const cargoTypes = ['electrodomesticos', 'maquinaria', 'alimentos', 'granos', 'materiales_construccion', 'quimicos', 'textil', 'otro'];
      for (const cargo_type of cargoTypes) {
        const result = await provider.getQuote({ ...baseParams, cargo_type });
        expect(result.premium).toBeGreaterThan(0);
      }
    });
  });

  describe('purchasePolicy', () => {
    it('returns a policy with null external_policy_id and coverage ending in 30 days', async () => {
      const before = new Date();
      const result = await provider.purchasePolicy({
        declared_value: 100000,
        cargo_type: 'granos',
        pickup_city: 'BA',
        dropoff_city: 'CBA',
        user_id: 'user-1',
        quote_id: 'q-abc',
      });

      expect(result.external_policy_id).toBeNull();
      expect(result.provider_data).toMatchObject({
        quote_id: 'q-abc',
        note: 'Póliza simulada — no tiene validez legal',
      });
      expect(result.provider_data?.issued_at).toBeDefined();

      // Coverage ends ~30 days from now
      const diff = result.coverage_ends_at.getTime() - before.getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });
  });
});
