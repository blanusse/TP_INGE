/**
 * Credenciales de test para cada tipo de usuario.
 * Podés sobreescribirlas con variables de entorno.
 *
 * ⚠ Usá cuentas de test — nunca credenciales de producción reales.
 */
export const CREDS = {
  dador: {
    email: process.env.TEST_DADOR_EMAIL ?? "dador_test@cargaback.test",
    password: process.env.TEST_DADOR_PASS ?? "TestPass123!",
  },
  transportista: {
    email: process.env.TEST_TRANS_EMAIL ?? "trans_test@cargaback.test",
    password: process.env.TEST_TRANS_PASS ?? "TestPass123!",
  },
  flota: {
    email: process.env.TEST_FLOTA_EMAIL ?? "flota_test@cargaback.test",
    password: process.env.TEST_FLOTA_PASS ?? "TestPass123!",
  },
  empleado: {
    email: process.env.TEST_EMPLEADO_EMAIL ?? "empleado_test@cargaback.test",
    password: process.env.TEST_EMPLEADO_PASS ?? "TestPass123!",
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? "admin@cargaback.test",
    password: process.env.TEST_ADMIN_PASS ?? "TestPass123!",
  },
} as const;
