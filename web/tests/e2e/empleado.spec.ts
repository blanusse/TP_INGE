/**
 * Tests para el rol Empleado de flota.
 * Requiere storageState autenticado como empleado.
 *
 * Cubre:
 *  - Dashboard y navegación (subset de transportista)
 *  - Mis viajes asignados por la flota
 *  - Mensajes
 *  - Mi perfil
 *  - Verificar que NO puede acceder a secciones de dueño
 */
import { test, expect } from "@playwright/test";

test.describe("Empleado — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/empleado");
    await page.waitForLoadState("networkidle");
  });

  test("carga el dashboard de empleado", async ({ page }) => {
    await expect(page).toHaveURL(/\/empleado/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("muestra los ítems de navegación del empleado", async ({ page }) => {
    const navItems = ["Mis viajes", "Mensajes", "Mi perfil"];
    for (const item of navItems) {
      await expect(page.getByText(item).first()).toBeVisible();
    }
  });

  test("el empleado NO ve el botón de gestión de flota", async ({ page }) => {
    // El empleado no debe poder gestionar la flota ni invitar conductores
    await expect(page.getByRole("button", { name: /Invitar conductor|Agregar camión/i })).not.toBeVisible();
  });

  test("no muestra error 500 al cargar", async ({ page }) => {
    await expect(page.getByText(/error interno|something went wrong/i)).not.toBeVisible();
  });
});

test.describe("Empleado — Mis viajes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/empleado");
    await page.waitForLoadState("networkidle");
    await page.getByText("Mis viajes").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de viajes", async ({ page }) => {
    await expect(page.getByText(/Mis viajes|Viajes|Entregas asignadas/i).first()).toBeVisible();
  });

  test("muestra viajes asignados o estado vacío", async ({ page }) => {
    const tieneViajes = await page.getByText(/km|En tránsito|código de entrega|entregado/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés viajes|sin viajes|todavía no|asignado/i).count() > 0;
    expect(tieneViajes || estaVacio).toBeTruthy();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Empleado — Mensajes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/empleado");
    await page.waitForLoadState("networkidle");
    await page.getByText("Mensajes").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de mensajes", async ({ page }) => {
    await expect(page.getByText(/Mensajes|Chat|Conversaciones/i).first()).toBeVisible();
  });

  test("muestra conversaciones o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneChats = await page.getByText(/hace|min|Hoy|Ayer/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés mensajes|sin mensajes|sin conversaciones|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneChats || estaVacio || cargando).toBeTruthy();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Empleado — Mi perfil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/empleado");
    await page.waitForLoadState("networkidle");
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de perfil", async ({ page }) => {
    await expect(page.getByText(/Mi perfil|Perfil|Cuenta/i).first()).toBeVisible();
  });

  test("muestra datos del usuario", async ({ page }) => {
    const tieneEmail = await page.getByText(/@/i).count() > 0;
    const tieneNombre = await page.getByText(/nombre|usuario|cuenta/i).count() > 0;
    expect(tieneEmail || tieneNombre).toBeTruthy();
  });

  test("tiene opción de cerrar sesión", async ({ page }) => {
    const btnSalir = page
      .getByRole("button", { name: /cerrar sesión|salir|logout/i })
      .or(page.getByText(/cerrar sesión|salir/i));
    await expect(btnSalir.first()).toBeVisible();
  });

  test("muestra a qué flota pertenece", async ({ page }) => {
    // El empleado debe ver el nombre del dueño de la flota
    const tieneFlota = await page.getByText(/flota|empleado|dueño/i).count() > 0;
    expect(tieneFlota).toBeTruthy();
  });
});

test.describe("Empleado — Aislamiento de rutas", () => {
  test("empleado en /flota es redirigido a /empleado", async ({ page }) => {
    await page.goto("/flota");
    await expect(page).toHaveURL(/\/empleado/, { timeout: 10_000 });
  });

  test("empleado en /transportista es redirigido a /empleado", async ({ page }) => {
    await page.goto("/transportista");
    await expect(page).toHaveURL(/\/empleado/, { timeout: 10_000 });
  });

  test("empleado no puede acceder a /dador", async ({ page }) => {
    await page.goto("/dador");
    await expect(page).not.toHaveURL(/\/dador/, { timeout: 10_000 });
  });

  test("empleado no puede acceder a /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 10_000 });
  });
});
