/**
 * Insurance provider abstraction.
 *
 * To integrate a real insurance API (e.g. Loadsure):
 *   1. Create `providers/loadsure.provider.ts` implementing InsuranceProvider.
 *   2. Replace the MockInsuranceProvider binding in insurance.module.ts.
 *   3. No other files need to change.
 */

export interface QuoteParams {
  declared_value: number; // ARS
  cargo_type: string;
  distance_km?: number;
  pickup_city: string;
  dropoff_city: string;
}

export interface QuoteResult {
  quote_id: string;
  premium: number; // ARS — what the user pays
  coverage_amount: number; // ARS — what's covered
  provider_name: string; // display name shown to user
  coverage_days: number;
  details: string[]; // bullet points shown in the quote modal
}

export interface PurchaseParams extends QuoteParams {
  user_id: string;
  load_id?: string;
  quote_id: string;
}

export interface PurchaseResult {
  external_policy_id: string | null;
  provider_data: Record<string, unknown> | null;
  coverage_ends_at: Date;
}

export const INSURANCE_PROVIDER = 'INSURANCE_PROVIDER';

export interface InsuranceProvider {
  readonly providerKey: string; // stored in DB, e.g. 'mock' | 'loadsure'
  getQuote(params: QuoteParams): Promise<QuoteResult>;
  purchasePolicy(params: PurchaseParams): Promise<PurchaseResult>;
}
