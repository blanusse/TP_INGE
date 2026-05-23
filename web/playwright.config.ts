import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 60_000,
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "https://cargaback.up.railway.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // ── Setup por rol: solo corre si el .json no existe ───────────────────
    {
      name: "setup:dador",
      testDir: "./tests/fixtures",
      testMatch: /.*\.setup\.ts/,
      grep: /autenticar dador/,
    },
    {
      name: "setup:transportista",
      testDir: "./tests/fixtures",
      testMatch: /.*\.setup\.ts/,
      grep: /autenticar transportista/,
    },
    {
      name: "setup:flota",
      testDir: "./tests/fixtures",
      testMatch: /.*\.setup\.ts/,
      grep: /autenticar flota/,
    },
    {
      name: "setup:empleado",
      testDir: "./tests/fixtures",
      testMatch: /.*\.setup\.ts/,
      grep: /autenticar empleado/,
    },
    {
      name: "setup:admin",
      testDir: "./tests/fixtures",
      testMatch: /.*\.setup\.ts/,
      grep: /autenticar admin/,
    },

    // ── Sin auth ──────────────────────────────────────────────────────────
    {
      name: "guest",
      testMatch: /guest\.spec\.ts/,
    },
    {
      name: "auth-flows",
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "registro-completo",
      testMatch: /registro-completo\.spec\.ts/,
    },

    // ── Con auth por rol ──────────────────────────────────────────────────
    {
      name: "dador",
      testMatch: /dador\.spec\.ts/,
      dependencies: ["setup:dador"],
      use: { storageState: "tests/fixtures/.auth/dador.json" },
    },
    {
      name: "transportista",
      testMatch: /transportista\.spec\.ts/,
      dependencies: ["setup:transportista"],
      use: { storageState: "tests/fixtures/.auth/transportista.json" },
    },
    {
      name: "flota",
      testMatch: /flota\.spec\.ts/,
      dependencies: ["setup:flota"],
      use: { storageState: "tests/fixtures/.auth/flota.json" },
    },
    {
      name: "empleado",
      testMatch: /empleado\.spec\.ts/,
      dependencies: ["setup:empleado"],
      use: { storageState: "tests/fixtures/.auth/empleado.json" },
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup:admin"],
      use: { storageState: "tests/fixtures/.auth/admin.json" },
    },

    // ── Flujos de negocio focalizados ──────────────────────────────────────
    {
      name: "publicar-carga",
      testMatch: /publicar-carga\.spec\.ts/,
      dependencies: ["setup:dador"],
      use: { storageState: "tests/fixtures/.auth/dador.json" },
    },
    {
      name: "aceptar-oferta",
      testMatch: /aceptar-oferta\.spec\.ts/,
      dependencies: ["setup:transportista"],
      use: { storageState: "tests/fixtures/.auth/transportista.json" },
    },
    {
      name: "flujo-completo",
      testMatch: /flujo-completo\.spec\.ts/,
      dependencies: ["setup:dador", "setup:transportista"],
    },
    {
      name: "flujo-pago",
      testMatch: /flujo-pago\.spec\.ts/,
      dependencies: ["setup:dador"],
      use: { storageState: "tests/fixtures/.auth/dador.json" },
    },
    {
      name: "documentos",
      testMatch: /documentos\.spec\.ts/,
      dependencies: ["setup:transportista"],
      use: { storageState: "tests/fixtures/.auth/transportista.json" },
    },

    // ── Fase 2: mensajes y flota ──────────────────────────────────────────
    {
      name: "mensajes",
      testMatch: /mensajes\.spec\.ts/,
      dependencies: ["setup:dador", "setup:transportista"],
    },
    {
      name: "flota-agregar-conductor",
      testMatch: /flota-agregar-conductor\.spec\.ts/,
      dependencies: ["setup:flota"],
      use: { storageState: "tests/fixtures/.auth/flota.json" },
    },
  ],

  // No arranca servidor local — corre contra el sitio desplegado
});
