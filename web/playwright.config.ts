import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 2,
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
    // Setup project: guarda las sesiones autenticadas en disco
    { name: "setup", testMatch: /.*\.setup\.ts/ },

    {
      name: "guest",
      testMatch: /guest\.spec\.ts/,
    },
    {
      name: "auth-flows",
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "dador",
      testMatch: /dador\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/dador.json" },
    },
    {
      name: "transportista",
      testMatch: /transportista\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/transportista.json" },
    },
    {
      name: "flota",
      testMatch: /flota\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/flota.json" },
    },
    {
      name: "empleado",
      testMatch: /empleado\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/empleado.json" },
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/admin.json" },
    },

    // ── Flujos de negocio focalizados ──────────────────────────────────────
    {
      name: "publicar-carga",
      testMatch: /publicar-carga\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/dador.json" },
    },
    {
      name: "aceptar-oferta",
      testMatch: /aceptar-oferta\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "tests/fixtures/.auth/transportista.json" },
    },
    {
      name: "flujo-completo",
      testMatch: /flujo-completo\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],

  // No arranca servidor local — corre contra el sitio desplegado
});
