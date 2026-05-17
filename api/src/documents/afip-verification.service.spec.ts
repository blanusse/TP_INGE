jest.mock('@nestjs/axios', () => ({ HttpService: class {} }));

import { AfipVerificationService } from './afip-verification.service';

describe('AfipVerificationService', () => {
  let service: AfipVerificationService;
  let httpService: { get: jest.Mock };

  beforeEach(() => {
    httpService = { get: jest.fn() };
    service = new AfipVerificationService(httpService as any);
  });

  // ── calcularDigitoVerificador ─────────────────────────────────────────────

  describe('calcularDigitoVerificador', () => {
    test('GIVEN prefijo 20 y DNI WHEN calcula dígito THEN devuelve dígito correcto', () => {
      // CUIT 20-30123456-3 es válido
      const digito = service.calcularDigitoVerificador('20', '30123456');
      expect(digito).toBe(3);
    });

    test('GIVEN prefijo 27 WHEN calcula dígito THEN devuelve dígito correcto', () => {
      const digito = service.calcularDigitoVerificador('27', '12345678');
      expect(typeof digito).toBe('number');
      expect(digito).toBeGreaterThanOrEqual(0);
      expect(digito).toBeLessThanOrEqual(9);
    });
  });

  // ── generarCuilsPosibles ──────────────────────────────────────────────────

  describe('generarCuilsPosibles', () => {
    test('GIVEN DNI WHEN generarCuilsPosibles THEN devuelve 3 CUILs (20, 27, 23)', () => {
      const cuils = service.generarCuilsPosibles('30123456');
      expect(cuils).toHaveLength(3);
      expect(cuils[0]).toMatch(/^20/);
      expect(cuils[1]).toMatch(/^27/);
      expect(cuils[2]).toMatch(/^23/);
      cuils.forEach((c) => expect(c).toHaveLength(11));
    });

    test('GIVEN DNI de 7 dígitos WHEN generarCuilsPosibles THEN paddea con 0', () => {
      const cuils = service.generarCuilsPosibles('1234567');
      cuils.forEach((c) => expect(c).toHaveLength(11));
      expect(cuils[0]).toContain('01234567');
    });
  });

  // ── compararNombres ───────────────────────────────────────────────────────

  describe('compararNombres', () => {
    test('GIVEN nombres que coinciden WHEN compararNombres THEN devuelve true', () => {
      expect(service.compararNombres('Juan Perez', 'JUAN', 'PEREZ')).toBe(true);
    });

    test('GIVEN nombres con acentos WHEN compararNombres THEN normaliza y coincide', () => {
      expect(service.compararNombres('José García', 'JOSE', 'GARCIA')).toBe(true);
    });

    test('GIVEN nombres totalmente distintos WHEN compararNombres THEN devuelve false', () => {
      expect(service.compararNombres('Carlos Lopez', 'MARIA', 'GOMEZ')).toBe(false);
    });

    test('GIVEN nombre con un solo token WHEN compararNombres THEN necesita solo 1 coincidencia', () => {
      expect(service.compararNombres('Juan', 'JUAN', 'PEREZ')).toBe(true);
    });
  });

  // ── verificarIdentidad ────────────────────────────────────────────────────

  describe('verificarIdentidad', () => {
    test('GIVEN AFIP confirma identidad WHEN verificarIdentidad THEN devuelve verified true', async () => {
      // Mock consultarAfip para el primer CUIL
      jest.spyOn(service, 'consultarAfip').mockResolvedValueOnce({
        nombre: 'JUAN',
        apellido: 'PEREZ',
      });

      const result = await service.verificarIdentidad('30123456', 'Juan Perez');

      expect(result.verified).toBe(true);
      expect(result.cuil_encontrado).toBeDefined();
    });

    test('GIVEN AFIP no encuentra a nadie WHEN verificarIdentidad THEN devuelve verified false', async () => {
      jest.spyOn(service, 'consultarAfip').mockResolvedValue(null);

      const result = await service.verificarIdentidad('99999999', 'Nadie Nada');

      expect(result.verified).toBe(false);
      expect(result.cuil_encontrado).toBeUndefined();
    });

    test('GIVEN AFIP encuentra persona pero nombre no coincide WHEN verificarIdentidad THEN devuelve false', async () => {
      jest.spyOn(service, 'consultarAfip').mockResolvedValue({
        nombre: 'MARIA',
        apellido: 'GOMEZ',
      });

      const result = await service.verificarIdentidad('30123456', 'Carlos Lopez');

      expect(result.verified).toBe(false);
    });
  });
});
