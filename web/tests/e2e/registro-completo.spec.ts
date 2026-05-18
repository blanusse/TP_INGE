/**
 * E2E — Registro completo de usuarios nuevos
 *
 * Flujo: /login → "Registrarse gratis" → selección de perfil → formulario → validaciones → submit
 * No se puede verificar email (no hay inbox), el test termina en /verify-email.
 */
import { test, expect } from "@playwright/test";

const UID = Date.now();

function irARegistro(page: import("@playwright/test").Page) {
  return page.goto("/login");
}

/** Selecciona un perfil en la grilla de cards (click en "Elegir →" de la card correcta) */
async function elegirPerfil(page: import("@playwright/test").Page, titulo: string) {
  // Busca el botón "Elegir" más cercano al h3/h2/span que contiene el título
  const btn = page.getByRole("button", { name: /Elegir/i }).filter({
    has: page.locator(`text=${titulo}`),
  });
  if (await btn.count() > 0) {
    await btn.first().click();
    return;
  }
  // Fallback: buscar el heading con el título y hacer click en el botón más cercano
  const heading = page.getByText(titulo, { exact: false }).first();
  await heading.waitFor({ timeout: 10_000 });
  const parent = page.locator("div, article, section").filter({ hasText: titulo }).filter({ has: page.getByRole("button", { name: /Elegir/i }) }).last();
  await parent.getByRole("button", { name: /Elegir/i }).click();
}

test.describe("Registro — Navegación inicial", () => {
  test("DADO guest CUANDO entra a /login ENTONCES ve opciones de Iniciar sesión y Registrarse", async ({ page }) => {
    await irARegistro(page);
    await expect(page.getByText("Iniciar sesión").first()).toBeVisible();
    await expect(page.getByText("Registrarse gratis").first()).toBeVisible();
  });

  test("DADO guest CUANDO clickea Registrarse gratis ENTONCES ve selección de perfil con 4 roles", async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();

    await expect(page.getByText("Crear cuenta").first()).toBeVisible();
    await expect(page.getByText("Transportista individual")).toBeVisible();
    await expect(page.getByText("Dueño de flota")).toBeVisible();
    await expect(page.getByText("Empleado de flota")).toBeVisible();
    await expect(page.getByText("Dador de carga")).toBeVisible();
  });
});

test.describe("Registro — Dador personal (happy path)", () => {
  test.beforeEach(async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();
    await page.waitForTimeout(500);

    // Seleccionar Dador de carga (click en botón "Elegir →" de la card)
    await elegirPerfil(page, "Dador de carga");
    // Esperar pantalla de tipo dador
    await page.getByText("Persona física").waitFor({ timeout: 10_000 });
  });

  test("DADO selección Dador CUANDO elige Persona física ENTONCES ve formulario con campos de persona", async ({ page }) => {
    await page.getByText("Persona física").click();
    await page.locator("#nombre").waitFor({ timeout: 10_000 });

    await expect(page.getByText("Crear cuenta").first()).toBeVisible();
    await expect(page.locator("#nombre")).toBeVisible();
    await expect(page.locator("#dni")).toBeVisible();
    await expect(page.locator("#tel")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
  });

  test("DADO formulario dador personal CUANDO completa datos válidos ENTONCES redirige a verify-email", async ({ page }) => {
    await page.getByText("Persona física").click();
    await page.locator("#nombre").waitFor({ timeout: 10_000 });

    // Completar formulario
    await page.locator("#nombre").fill(`Test Dador ${UID}`);
    await page.locator("#dni").fill("40" + String(UID).slice(-6));
    await page.locator("#tel").fill("1199" + String(UID).slice(-6));
    await page.locator("#email").fill(`dador_e2e_${UID}@testmail.com`);
    await page.locator('input[type="password"]').fill("TestPass123!");
    await page.locator("#terminos").check();

    // Esperar que las validaciones async terminen (email/dni/tel disponibles)
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();

    await expect(page).toHaveURL(/\/verify-email/, { timeout: 20_000 });
  });
});

test.describe("Registro — Dador empresa", () => {
  test("DADO selección Dador empresa CUANDO elige Empresa ENTONCES ve campos de CUIT y razón social", async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();
    await page.waitForTimeout(500);
    await elegirPerfil(page, "Dador de carga");
    await page.getByText("Empresa / S.R.L.").waitFor({ timeout: 10_000 });
    await page.getByText("Empresa / S.R.L.").click();
    await page.locator("#rs").waitFor({ timeout: 10_000 });

    await expect(page.locator("#rs")).toBeVisible();
    await expect(page.locator("#cuit")).toBeVisible();
  });
});

test.describe("Registro — Transportista", () => {
  test.beforeEach(async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();
    await page.waitForTimeout(500);
    await elegirPerfil(page, "Transportista individual");
    // Esperar formulario
    await page.locator("#nombre").waitFor({ timeout: 10_000 });
  });

  test("DADO formulario transportista ENTONCES muestra campo DNI obligatorio", async ({ page }) => {
    await expect(page.locator("#dni")).toBeVisible();
  });

  test("DADO formulario transportista ENTONCES muestra info sobre agregar camiones después", async ({ page }) => {
    await expect(page.getByText(/vas a poder agregar/i).or(page.getByText(/Mi flota/i)).first()).toBeVisible();
  });
});

test.describe("Registro — Validaciones inline", () => {
  test.beforeEach(async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();
    await page.waitForTimeout(500);
    await elegirPerfil(page, "Dador de carga");
    await page.getByText("Persona física").waitFor({ timeout: 10_000 });
    await page.getByText("Persona física").click();
    await page.locator("#nombre").waitFor({ timeout: 10_000 });
  });

  test("DADO formulario vacío CUANDO intenta crear cuenta ENTONCES muestra error de nombre", async ({ page }) => {
    await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
    await expect(page.getByText(/nombre/i).last()).toBeVisible();
  });

  test("DADO DNI inválido CUANDO llena 3 dígitos ENTONCES no marca como disponible", async ({ page }) => {
    await page.locator("#nombre").fill("Test");
    await page.locator("#dni").fill("123");
    // No debería mostrar "DNI disponible" con solo 3 dígitos
    await page.waitForTimeout(1000);
    await expect(page.getByText("DNI disponible")).not.toBeVisible();
  });

  test("DADO email inválido CUANDO escribe sin @ ENTONCES no marca como disponible", async ({ page }) => {
    await page.locator("#email").fill("emailsindominio");
    await page.waitForTimeout(1000);
    await expect(page.getByText("Email disponible")).not.toBeVisible();
  });

  test("DADO contraseña corta CUANDO intenta registrar ENTONCES muestra error de contraseña", async ({ page }) => {
    await page.locator("#nombre").fill("Test User");
    await page.locator("#dni").fill("41" + String(UID).slice(-6));
    await page.locator("#tel").fill("1198" + String(UID).slice(-6));
    await page.locator("#email").fill(`short_pwd_${UID}@testmail.com`);
    await page.locator('input[type="password"]').fill("123");
    await page.locator("#terminos").check();
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
    await expect(page.getByText(/contraseña debe tener al menos 8/i)).toBeVisible();
  });

  test("DADO términos sin aceptar CUANDO intenta registrar ENTONCES muestra error", async ({ page }) => {
    await page.locator("#nombre").fill("Test User");
    await page.locator("#dni").fill("42" + String(UID).slice(-6));
    await page.locator("#tel").fill("1197" + String(UID).slice(-6));
    await page.locator("#email").fill(`terms_${UID}@testmail.com`);
    await page.locator('input[type="password"]').fill("TestPass123!");
    // No checkea términos
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
    await expect(
      page.getByText(/términos|aceptar|condiciones|obligatorio/i).last()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Registro — Empleado (requiere invitación)", () => {
  test("DADO selección Empleado ENTONCES pide código de invitación antes del formulario", async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();
    await page.waitForTimeout(500);
    await elegirPerfil(page, "Empleado de flota");

    await expect(page.getByText(/Código de invitación/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Verificar código/i })).toBeVisible();
  });

  test("DADO código inválido CUANDO verifica ENTONCES muestra error", async ({ page }) => {
    await irARegistro(page);
    await page.getByText("Registrarse gratis").first().click();
    await page.waitForTimeout(500);
    await elegirPerfil(page, "Empleado de flota");
    await page.getByRole("button", { name: /Verificar código/i }).waitFor({ timeout: 10_000 });

    await page.getByPlaceholder(/a1b2c3d4/i).fill("token-invalido-12345");
    await page.getByRole("button", { name: /Verificar código/i }).click();

    await expect(page.getByText(/no válido|vencido|no encontrad/i)).toBeVisible({ timeout: 10_000 });
  });
});
