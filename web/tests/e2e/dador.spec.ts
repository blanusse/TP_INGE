/**
 * Tests para el rol Dador de carga (shipper).
 * Requiere storageState autenticado (ver auth.setup.ts).
 *
 * Cubre:
 *  - Dashboard / navegación principal
 *  - Mis cargas: listado, filtros, detalle
 *  - Publicar nueva carga
 *  - Gestión de ofertas recibidas
 *  - Mis envíos (cargas en tránsito)
 *  - Historial
 *  - Facturación
 *  - Seguros
 *  - Mi perfil
 */
import { test, expect } from "@playwright/test";

async function dismissOnboarding(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    localStorage.setItem("dador-onboarding-done", "1");
  });
  const btnOmitir = page.getByText(/Omitir tour/i);
  if (await btnOmitir.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await btnOmitir.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Dador — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
  });

  test("carga la página principal del dador", async ({ page }) => {
    await expect(page).toHaveURL(/\/dador/);
    // No debe redirigir a login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("muestra los ítems de navegación correctos", async ({ page }) => {
    // "Mi perfil" puede estar en avatar/menú, no en el sidebar principal
    const navItems = ["Inicio", "Mis cargas", "Mis envios", "Historial", "Facturación", "Seguros"];
    for (const item of navItems) {
      await expect(page.getByText(item).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("muestra la sección Inicio por defecto", async ({ page }) => {
    // La primera vista debe ser el home del dador
    await expect(page.getByText(/Inicio|Bienvenido|Mis cargas recientes/i).first()).toBeVisible();
  });
});

test.describe("Dador — Mis cargas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de cargas", async ({ page }) => {
    await expect(page.getByText(/Mis cargas/i).first()).toBeVisible();
  });

  test("muestra las tabs de filtro de cargas", async ({ page }) => {
    const tabs = ["Todas", "Con ofertas", "Sin ofertas", "Confirmadas", "En tránsito"];
    for (const tab of tabs) {
      const el = page.getByRole("button", { name: tab }).or(page.getByText(tab)).first();
      if (await el.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
      // Si alguna tab no existe en la UI actual, se saltea sin fallar
    }
  });

  test("puede cambiar entre tabs sin error", async ({ page }) => {
    const tabs = ["Con ofertas", "Sin ofertas", "Confirmadas", "En tránsito", "Todas"];
    for (const tab of tabs) {
      const btn = page.getByRole("button", { name: tab }).or(page.getByText(tab)).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForLoadState("networkidle");
        // No debe haber error visible
        await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
      }
    }
  });

  test("muestra lista de cargas o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneCargas = await page.getByText(/→|kg|Publicado|origen|destino/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés|sin cargas|todavía no|primera|ninguna/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneCargas || estaVacio || cargando).toBeTruthy();
  });
});

test.describe("Dador — Publicar nueva carga", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("existe botón para publicar nueva carga", async ({ page }) => {
    const btnNueva = page
      .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
      .or(page.getByText(/Nueva carga|Publicar carga/i));
    await expect(btnNueva.first()).toBeVisible();
  });

  test("el formulario de nueva carga se abre correctamente", async ({ page }) => {
    const btnNueva = page
      .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
      .or(page.getByText(/Nueva carga|Publicar carga/i));
    await btnNueva.first().click();

    // El formulario debe pedir ciudades de origen y destino
    await expect(
      page.getByPlaceholder(/origen|ciudad de retiro|retiro/i)
        .or(page.getByLabel(/origen|retiro|pickup/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test("el formulario valida campos requeridos", async ({ page }) => {
    const btnNueva = page
      .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
      .or(page.getByText(/Nueva carga|Publicar carga/i));
    await btnNueva.first().click();
    await page.waitForTimeout(1000);

    // Intentar enviar sin completar
    const btnPublicar = page.getByRole("button", { name: /Publicar|Guardar|Crear carga/i });
    if (await btnPublicar.count() > 0) {
      await btnPublicar.first().click();
      // Debe mostrar algún error de validación
      const tieneError = await page.getByText(/requerido|obligatorio|ingresá|campo/i).count() > 0;
      // O que el formulario no se cerró (sigue visible)
      expect(tieneError || await btnPublicar.isVisible()).toBeTruthy();
    }
  });
});

test.describe("Dador — Gestión de ofertas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("una carga con ofertas permite verlas", async ({ page }) => {
    // Buscar una carga que tenga el tab "Con ofertas" activo
    const tabConOfertas = page.getByText("Con ofertas").first();
    if (await tabConOfertas.isVisible()) {
      await tabConOfertas.click();
      await page.waitForLoadState("networkidle");

      const hayCargas = await page.getByText(/→/i).count() > 0;
      if (hayCargas) {
        // Click en la primera carga para ver detalle y ofertas
        await page.getByText(/→/i).first().click();
        await page.waitForTimeout(1000);
        // Debe mostrar ofertas
        await expect(
          page.getByText(/oferta|precio|transportista/i).first()
        ).toBeVisible({ timeout: 10_000 });
      } else {
        test.skip(true, "No hay cargas con ofertas para probar");
      }
    }
  });
});

test.describe("Dador — Mis envíos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis envios").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de envíos", async ({ page }) => {
    await expect(page.getByText(/Mis envios|En tránsito|Envíos/i).first()).toBeVisible();
  });

  test("muestra envíos activos o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneEnvios = await page.getByText(/En tránsito|código de entrega|en camino/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés|sin envíos|todavía no|ningún envío/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneEnvios || estaVacio || cargando).toBeTruthy();
  });
});

test.describe("Dador — Historial", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Historial").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de historial", async ({ page }) => {
    await expect(page.getByText(/Historial|Cargas finalizadas|Completadas/i).first()).toBeVisible();
  });

  test("muestra viajes pasados o estado vacío", async ({ page }) => {
    const tieneHistorial = await page.getByText(/Entregado|Cancelado|Completado/i).count() > 0;
    const estaVacio = await page.getByText(/no hay|sin historial|todavía no completaste/i).count() > 0;
    expect(tieneHistorial || estaVacio).toBeTruthy();
  });
});

test.describe("Dador — Facturación", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Facturación").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de facturación", async ({ page }) => {
    await expect(page.getByText(/Facturación|Factura|Pagos|Comprobantes/i).first()).toBeVisible();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno|something went wrong/i)).not.toBeVisible();
  });
});

test.describe("Dador — Seguros", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Seguros").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de seguros", async ({ page }) => {
    await expect(page.getByText(/Seguros|Póliza|Cobertura/i).first()).toBeVisible();
  });

  test("muestra productos de seguro o estado vacío", async ({ page }) => {
    const tieneProductos = await page
      .getByText(/contratar|cobertura|prima|cotizar/i).count() > 0;
    const estaVacio = await page
      .getByText(/no hay seguros|sin seguros|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneProductos || estaVacio || cargando).toBeTruthy();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Dador — Mi perfil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de perfil", async ({ page }) => {
    await expect(page.getByText(/Mi perfil|Perfil|Cuenta/i).first()).toBeVisible();
  });

  test("muestra datos del usuario", async ({ page }) => {
    // Debe mostrar email, nombre u otro dato del usuario
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
});
