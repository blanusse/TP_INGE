import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  InsuranceProvider,
  QuoteParams,
  QuoteResult,
  PurchaseParams,
  PurchaseResult,
} from '../insurance.provider';

/**
 * Simulated insurance provider.
 * Calculates premiums with a simple rate table based on cargo type and distance.
 *
 * To replace with a real provider:
 *   - Create providers/loadsure.provider.ts implementing InsuranceProvider
 *   - Change the binding in insurance.module.ts
 */

const CARGO_RATES: Record<string, number> = {
  electrodomesticos: 0.025,
  maquinaria: 0.022,
  alimentos: 0.012,
  granos: 0.008,
  materiales_construccion: 0.010,
  quimicos: 0.020,
  textil: 0.015,
  otro: 0.015,
};

const COVERAGE_DAYS = 30;

@Injectable()
export class MockInsuranceProvider implements InsuranceProvider {
  readonly providerKey = 'mock';

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const rate = CARGO_RATES[params.cargo_type] ?? 0.015;
    const distanceFactor = params.distance_km
      ? 1 + params.distance_km / 20000 // up to +5% for long hauls
      : 1;
    const premium = Math.round(params.declared_value * rate * distanceFactor);
    const coverageAmount = params.declared_value;

    return {
      quote_id: randomUUID(),
      premium,
      coverage_amount: coverageAmount,
      provider_name: 'CargaBack Seguros',
      coverage_days: COVERAGE_DAYS,
      details: [
        'Cobertura todo riesgo de la carga durante el transporte',
        'Daños por accidente, robo y siniestros en ruta',
        `Vigencia de ${COVERAGE_DAYS} días desde la emisión`,
        'Atención de siniestros dentro de las 48 horas hábiles',
      ],
    };
  }

  async purchasePolicy(params: PurchaseParams): Promise<PurchaseResult> {
    const coverageEndsAt = new Date();
    coverageEndsAt.setDate(coverageEndsAt.getDate() + COVERAGE_DAYS);

    return {
      external_policy_id: null, // mock: no external system
      provider_data: {
        quote_id: params.quote_id,
        issued_at: new Date().toISOString(),
        note: 'Póliza simulada — no tiene validez legal',
      },
      coverage_ends_at: coverageEndsAt,
    };
  }
}
