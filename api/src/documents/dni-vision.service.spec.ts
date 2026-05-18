import { DniVisionService } from './dni-vision.service';

describe('DniVisionService', () => {
  let service: DniVisionService;

  beforeEach(() => {
    service = new DniVisionService();
  });

  // ── isDniDocument ─────────────────────────────────────────────────────────

  describe('isDniDocument', () => {
    test('GIVEN texto con keywords de DNI WHEN isDniDocument THEN devuelve true', () => {
      const text = 'REPUBLICA ARGENTINA DOCUMENTO NACIONAL DE IDENTIDAD DNI APELLIDO PEREZ';
      expect(service.isDniDocument(text)).toBe(true);
    });

    test('GIVEN texto sin keywords WHEN isDniDocument THEN devuelve false', () => {
      expect(service.isDniDocument('texto random cualquiera')).toBe(false);
    });
  });

  // ── isLicenseDocument ─────────────────────────────────────────────────────

  describe('isLicenseDocument', () => {
    test('GIVEN texto de licencia WHEN isLicenseDocument THEN devuelve true', () => {
      expect(service.isLicenseDocument('LICENCIA DE CONDUCIR CLASE B')).toBe(true);
    });

    test('GIVEN texto sin keywords WHEN isLicenseDocument THEN devuelve false', () => {
      expect(service.isLicenseDocument('nada relevante')).toBe(false);
    });
  });

  // ── isVtvDocument ─────────────────────────────────────────────────────────

  describe('isVtvDocument', () => {
    test('GIVEN texto de VTV WHEN isVtvDocument THEN devuelve true', () => {
      expect(service.isVtvDocument('VTV VERIFICACION TECNICA VEHICULAR')).toBe(true);
    });
  });

  // ── isSeguroDocument ──────────────────────────────────────────────────────

  describe('isSeguroDocument', () => {
    test('GIVEN texto de póliza WHEN isSeguroDocument THEN devuelve true', () => {
      expect(service.isSeguroDocument('SEGURO POLIZA COBERTURA AUTOMOTOR')).toBe(true);
    });
  });

  // ── isCedulaVerdeDocument ─────────────────────────────────────────────────

  describe('isCedulaVerdeDocument', () => {
    test('GIVEN texto de cédula verde WHEN isCedulaVerdeDocument THEN devuelve true', () => {
      expect(service.isCedulaVerdeDocument('CEDULA VERDE TITULAR DOMINIO DNRPA')).toBe(true);
    });
  });

  // ── isCedulaAzulDocument ──────────────────────────────────────────────────

  describe('isCedulaAzulDocument', () => {
    test('GIVEN texto de cédula azul WHEN isCedulaAzulDocument THEN devuelve true', () => {
      expect(service.isCedulaAzulDocument('CEDULA AZUL AUTORIZACIÓN CONDUCTOR')).toBe(true);
    });
  });

  // ── isRucttDocument ───────────────────────────────────────────────────────

  describe('isRucttDocument', () => {
    test('GIVEN texto de RUCTT WHEN isRucttDocument THEN devuelve true', () => {
      expect(service.isRucttDocument('RUCTT CNRT HABILITACION TRANSPORTE')).toBe(true);
    });
  });

  // ── dniFoundInText ────────────────────────────────────────────────────────

  describe('dniFoundInText', () => {
    test('GIVEN DNI presente en texto WHEN dniFoundInText THEN devuelve true', () => {
      expect(service.dniFoundInText('DNI 30.123.456', '30123456')).toBe(true);
    });

    test('GIVEN DNI ausente WHEN dniFoundInText THEN devuelve false', () => {
      expect(service.dniFoundInText('DNI 99999999', '30123456')).toBe(false);
    });

    test('GIVEN DNI con puntos y espacios WHEN dniFoundInText THEN normaliza y encuentra', () => {
      expect(service.dniFoundInText('30 123 456', '30.123.456')).toBe(true);
    });
  });

  // ── plateFoundInText ──────────────────────────────────────────────────────

  describe('plateFoundInText', () => {
    test('GIVEN patente presente WHEN plateFoundInText THEN devuelve true', () => {
      expect(service.plateFoundInText('DOMINIO AB 123 CD', 'AB123CD')).toBe(true);
    });

    test('GIVEN patente ausente WHEN plateFoundInText THEN devuelve false', () => {
      expect(service.plateFoundInText('DOMINIO XX999YY', 'AB123CD')).toBe(false);
    });
  });

  // ── extractExpiryDate ─────────────────────────────────────────────────────

  describe('extractExpiryDate', () => {
    test('GIVEN fecha futura DD/MM/YYYY WHEN extractExpiryDate THEN devuelve Date', () => {
      const result = service.extractExpiryDate('Vencimiento: 15/12/2028');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2028);
    });

    test('GIVEN múltiples fechas futuras DD/MM/YYYY WHEN extractExpiryDate THEN devuelve la más lejana', () => {
      const result = service.extractExpiryDate('Desde 10/06/2027 hasta 15/12/2029');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2029);
    });

    test('GIVEN fecha MM/YYYY futura WHEN extractExpiryDate THEN devuelve Date', () => {
      const result = service.extractExpiryDate('Vigencia: 06/2029');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2029);
    });

    test('GIVEN múltiples fechas MM/YYYY futuras WHEN extractExpiryDate THEN devuelve la más lejana', () => {
      const result = service.extractExpiryDate('Vigente 06/2027 hasta 12/2030');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2030);
    });

    test('GIVEN sin fechas WHEN extractExpiryDate THEN devuelve null', () => {
      expect(service.extractExpiryDate('sin fecha alguna')).toBeNull();
    });
  });
});
