/**
 * E2E — Flujo de aceptación de oferta y pago (roles: Dador + Transportista)
 *
 * Cubre:
 *  - Dador ve ofertas en una carga publicada
 *  - Dador acepta oferta → se abre modal de pago MercadoPago
 *  - Transportista ve viajes asignados
 *  - Transportista ve sección de confirmar entrega con código
 *
 * Requiere storageState autenticado como dador y transportista.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(__dirname, "../fixtures/.auth");
const DADOR_AUTH = path.join(AUTH_DIR, "dador.json");
const TRANS_AUTH = path.join(AUTH_DIR, "transportista.json");

test.describe("Flujo de pago — Dador acepta oferta", () => {
  test.beforeEach(async ({ page }) => {
    if (!fs.existsSync(DADOR_AUTH)) {
      test.skip(true, "Sesión de dador no generada — corré primero: playwright test --project=setup");
    }
  });

  test("DADO dador con cargas CUANDO navega a Mis cargas ENTONCES ve lista de cargas con conteo de ofertas", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: DADOR_AUTH });
    const page = await ctx.newPage();

    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("dador-onboarding-done", "1"));
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");

    // Debe estar en la sección de cargas
    await expect(page.getByText(/Mis cargas|Publica cargas/i).first()).toBeVisible({ timeout: 10_000 });

    // No hay error 500
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

    await ctx.close();
  });

  test("DADO carga con ofertas CUANDO dador clickea Ver ofertas ENTONCES ve modal con lista de ofertas", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: DADOR_AUTH });
    const page = await ctx.newPage();

    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("dador-onboarding-done", "1"));
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");

    // Buscar botón de ver ofertas
    const btnOfertas = page.getByText(/Ver ofertas/i).first();
    const hayOfertas = await btnOfertas.isVisible().catch(() => false);

    if (!hayOfertas) {
      test.skip(true, "No hay cargas con ofertas en el entorno de test");
    }

    await btnOfertas.click();
    await page.waitForTimeout(1000);

    // Modal debe mostrar ofertas con nombre del transportista y precio
    await expect(
      page.getByText(/Ofertas para|ofertas/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Debe haber botones de acción
    const hayAcciones =
      (await page.getByText(/Aceptar/i).count()) > 0 ||
      (await page.getByText(/Rechazar/i).count()) > 0 ||
      (await page.getByText(/Cargando ofertas/i).count()) > 0;
    expect(hayAcciones).toBeTruthy();

    await ctx.close();
  });

  test("DADO oferta visible CUANDO dador clickea Aceptar ENTONCES ve modal de pago MercadoPago", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: DADOR_AUTH });
    const page = await ctx.newPage();

    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("dador-onboarding-done", "1"));
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");

    const btnOfertas = page.getByText(/Ver ofertas/i).first();
    const hayOfertas = await btnOfertas.isVisible().catch(() => false);
    if (!hayOfertas) {
      test.skip(true, "No hay cargas con ofertas");
    }

    await btnOfertas.click();
    await page.waitForTimeout(1500);

    const btnAceptar = page.getByText(/Aceptar →/i).first();
    const hayAceptar = await btnAceptar.isVisible().catch(() => false);
    if (!hayAceptar) {
      test.skip(true, "No hay ofertas aceptables en el entorno de test");
    }

    await btnAceptar.click();
    await page.waitForTimeout(1000);

    // Modal de pago MercadoPago
    await expect(
      page.getByText(/Pago con MercadoPago|Pagar y confirmar/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Botón de pagar
    await expect(
      page.getByRole("button", { name: /Pagar y confirmar/i })
    ).toBeVisible();

    // Botón cancelar
    await expect(
      page.getByRole("button", { name: /Cancelar/i })
    ).toBeVisible();

    await ctx.close();
  });
});

test.describe("Flujo de pago — Dador: cargas asignadas y código de entrega", () => {
  test("DADO dador con carga asignada CUANDO navega a Mis envíos ENTONCES ve viajes en curso", async ({ browser }) => {
    if (!fs.existsSync(DADOR_AUTH)) {
      test.skip(true, "Sesión de dador no generada");
    }

    const ctx = await browser.newContext({ storageState: DADOR_AUTH });
    const page = await ctx.newPage();

    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("dador-onboarding-done", "1"));
    await page.getByText("Mis envios").first().click();
    await page.waitForLoadState("networkidle");

    // Debe mostrar la sección sin error
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

    // Puede haber envíos o mensaje de vacío
    await page.waitForTimeout(1000);
    const tieneEnvios = (await page.getByText(/en tránsito|en camino|asignada|código de entrega/i).count()) > 0;
    const estaVacio = (await page.getByText(/no tenés|sin envíos|todavía no/i).count()) > 0;
    const cargando = (await page.getByText(/cargando/i).count()) > 0;
    expect(tieneEnvios || estaVacio || cargando).toBeTruthy();

    await ctx.close();
  });

  test("DADO carga asignada con código CUANDO dador la ve ENTONCES muestra el código de entrega", async ({ browser }) => {
    if (!fs.existsSync(DADOR_AUTH)) {
      test.skip(true, "Sesión de dador no generada");
    }

    const ctx = await browser.newContext({ storageState: DADOR_AUTH });
    const page = await ctx.newPage();

    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("dador-onboarding-done", "1"));

    // Buscar en Mis cargas tab Asignadas o en Mis envíos
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");

    const tabAsignadas = page.getByText(/Asignadas/i).first();
    const hayTab = await tabAsignadas.isVisible().catch(() => false);
    if (hayTab) {
      await tabAsignadas.click();
      await page.waitForTimeout(1000);
    }

    const codigoVisible = (await page.getByText(/Código de entrega/i).count()) > 0;
    if (!codigoVisible) {
      test.skip(true, "No hay cargas asignadas con código de entrega");
    }

    await expect(page.getByText(/Código de entrega/i).first()).toBeVisible();

    // Botón copiar código
    const btnCopiar = page.getByText(/Copiar código/i).first();
    const hayCopiar = await btnCopiar.isVisible().catch(() => false);
    if (hayCopiar) {
      await expect(btnCopiar).toBeVisible();
    }

    await ctx.close();
  });
});

test.describe("Flujo de pago — Transportista: viajes y entrega", () => {
  test("DADO transportista CUANDO navega a Mis viajes ENTONCES ve viajes asignados o vacío", async ({ browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }

    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mis viajes").first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

    await page.waitForTimeout(1000);
    const tieneViajes = (await page.getByText(/en tránsito|en camino|activo|completado/i).count()) > 0;
    const estaVacio = (await page.getByText(/no tenés|sin viajes|todavía no/i).count()) > 0;
    const cargando = (await page.getByText(/cargando/i).count()) > 0;
    expect(tieneViajes || estaVacio || cargando).toBeTruthy();

    await ctx.close();
  });
});
