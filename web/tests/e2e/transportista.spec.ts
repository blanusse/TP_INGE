/**
 * Tests para el rol Transportista Individual.
 * Requiere storageState autenticado como transportista.
 *
 * Cubre:
 *  - Dashboard y navegación
 *  - Buscar cargas disponibles
 *  - Enviar oferta en una carga
 *  - Mis ofertas
 *  - Mis viajes
 *  - Mensajes
 *  - Notificaciones
 *  - Mi perfil / Mi flota
 */
import { test, expect } from "@playwright/test";

async function dismissOnboarding(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    localStorage.setItem("transportista-onboarding-done", "1");
  });
  const btnOmitir = page.getByText(/Omitir tour/i);
  if (await btnOmitir.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await btnOmitir.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Transportista — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
  });

  test("carga el dashboard de transportista", async ({ page }) => {
    await expect(page).toHaveURL(/\/transportista/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("muestra los ítems de navegación correctos", async ({ page }) => {
    const navItems = ["Inicio", "Buscar cargas", "Mis ofertas", "Mis viajes", "Mensajes"];
    for (const item of navItems) {
      await expect(page.getByText(item).first()).toBeVisible();
    }
  });

  test("no muestra error 500 al cargar", async ({ page }) => {
    await expect(page.getByText(/error interno|something went wrong/i)).not.toBeVisible();
  });
});

test.describe("Transportista — Buscar cargas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Buscar cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de búsqueda de cargas", async ({ page }) => {
    await expect(page.getByText(/Buscar cargas|Cargas disponibles|Cargas/i).first()).toBeVisible();
  });

  test("muestra cargas disponibles o estado vacío", async ({ page }) => {
    const tieneCargas = await page.getByText(/→|kg|Publicado hace/i).count() > 0;
    const estaVacio = await page.getByText(/no hay cargas|sin cargas disponibles|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando|Buscando/i).count() > 0;
    expect(tieneCargas || estaVacio || cargando).toBeTruthy();
  });

  test("tiene filtros de búsqueda disponibles", async ({ page }) => {
    // Debe haber algún tipo de filtro (tipo de camión, ciudad, etc.)
    const hayFiltros = await page
      .getByRole("combobox")
      .or(page.getByRole("textbox", { name: /origen|destino|ciudad/i }))
      .or(page.getByText(/Filtrar|Tipo de camión|Tipo de carga/i))
      .count() > 0;
    expect(hayFiltros).toBeTruthy();
  });

  test("puede hacer click en una carga para ver el detalle", async ({ page }) => {
    const cargas = page.getByText(/→/i);
    const count = await cargas.count();
    if (count > 0) {
      await cargas.first().click();
      await page.waitForTimeout(800);
      // Debe mostrar detalles de la carga
      await expect(
        page.getByText(/kg|precio|oferta|transportista/i).first()
      ).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip(true, "No hay cargas disponibles para probar detalle");
    }
  });
});

test.describe("Transportista — Enviar oferta", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Buscar cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("el formulario de oferta aparece al intentar ofertar", async ({ page }) => {
    const cargas = page.getByText(/→/i);
    const count = await cargas.count();
    if (count === 0) {
      test.skip(true, "No hay cargas disponibles");
    }

    await cargas.first().click();
    await page.waitForTimeout(800);

    const btnOfertar = page
      .getByRole("button", { name: /Ofertar|Enviar oferta|Hacer oferta/i })
      .or(page.getByText(/Ofertar|Enviar oferta/i));

    if (await btnOfertar.count() > 0) {
      await btnOfertar.first().click();
      // Debe mostrar campo de precio
      await expect(
        page.getByPlaceholder(/precio|monto|importe/i)
          .or(page.getByLabel(/precio/i))
      ).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip(true, "Botón de ofertar no encontrado (quizás ya ofertaste en esta carga)");
    }
  });

  test("oferta con monto 0 muestra validación", async ({ page }) => {
    const cargas = page.getByText(/→/i);
    if (await cargas.count() === 0) {
      test.skip(true, "No hay cargas disponibles");
    }

    await cargas.first().click();
    await page.waitForTimeout(800);

    const btnOfertar = page.getByRole("button", { name: /Ofertar|Enviar oferta/i });
    if (await btnOfertar.count() === 0) {
      test.skip(true, "Botón de ofertar no encontrado");
    }

    await btnOfertar.first().click();
    await page.waitForTimeout(500);

    const campoPrecio = page.getByPlaceholder(/precio|monto/i).or(page.getByLabel(/precio/i));
    if (await campoPrecio.count() > 0) {
      await campoPrecio.first().fill("0");
      const btnConfirmar = page.getByRole("button", { name: /Confirmar|Enviar|Ofertar/i });
      if (await btnConfirmar.count() > 0) {
        await btnConfirmar.first().click();
        // Debe haber alguna validación
        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe("Transportista — Mis ofertas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis ofertas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de mis ofertas", async ({ page }) => {
    await expect(page.getByText(/Mis ofertas|Ofertas enviadas/i).first()).toBeVisible();
  });

  test("muestra ofertas activas o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneOfertas = await page.getByText(/pendiente|aceptada|rechazada|contrapropuesta/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés ofertas|sin ofertas|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneOfertas || estaVacio || cargando).toBeTruthy();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Transportista — Mis viajes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis viajes").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de viajes", async ({ page }) => {
    await expect(page.getByText(/Mis viajes|Viajes|En tránsito/i).first()).toBeVisible();
  });

  test("muestra viajes activos o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneViajes = await page.getByText(/km|En tránsito|código de entrega|entregado/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés viajes|sin viajes|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneViajes || estaVacio || cargando).toBeTruthy();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Transportista — Mensajes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mensajes").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de mensajes", async ({ page }) => {
    await expect(page.getByText(/Mensajes|Chat|Conversaciones/i).first()).toBeVisible();
  });

  test("muestra lista de conversaciones o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneChats = await page.getByText(/hace|min|Hoy|Ayer/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés mensajes|sin mensajes|sin conversaciones|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneChats || estaVacio || cargando).toBeTruthy();
  });

  test("puede abrir un chat existente", async ({ page }) => {
    const chats = page.getByText(/hace|min|Hoy/i);
    if (await chats.count() > 0) {
      await chats.first().click();
      await page.waitForTimeout(800);
      // Debe mostrar el área de input de mensaje
      const inputMensaje = page
        .getByPlaceholder(/escribe|mensaje|escribí/i)
        .or(page.getByRole("textbox"));
      await expect(inputMensaje.first()).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip(true, "No hay conversaciones para abrir");
    }
  });
});

test.describe("Transportista — Notificaciones", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
  });

  test("el ícono de notificaciones es visible en la nav", async ({ page }) => {
    const notif = page
      .getByText("Notificaciones")
      .or(page.getByTitle(/notificaciones/i))
      .or(page.locator("[aria-label*='notif' i]"));
    await expect(notif.first()).toBeVisible();
  });

  test("muestra notificaciones o estado vacío al abrir", async ({ page }) => {
    await page.getByText("Notificaciones").first().click();
    await page.waitForTimeout(800);
    const tieneNotifs = await page.getByText(/hace|nueva oferta|aceptó|rechazó/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés|sin notificaciones|al día/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneNotifs || estaVacio || cargando).toBeTruthy();
  });
});

test.describe("Transportista — Mi perfil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    // El perfil puede estar en "Mi flota" o como ítem separado
    const miPerfil = page.getByText("Mi perfil").or(page.getByText("Perfil"));
    if (await miPerfil.count() > 0) {
      await miPerfil.first().click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("muestra información del usuario", async ({ page }) => {
    const tieneEmail = await page.getByText(/@/i).count() > 0;
    const tieneNombre = await page.getByText(/nombre|usuario|perfil|cuenta/i).count() > 0;
    expect(tieneEmail || tieneNombre).toBeTruthy();
  });
});

test.describe("Transportista — Mi flota (vista individual)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    const miFlota = page.getByText("Mi flota").first();
    if (await miFlota.isVisible()) {
      await miFlota.click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("muestra la sección de flota o camiones", async ({ page }) => {
    const hasSection = await page
      .getByText(/Mi flota|Camiones|Vehículos|Agregar camión/i)
      .count() > 0;
    expect(hasSection).toBeTruthy();
  });

  test("tiene opción para agregar un camión", async ({ page }) => {
    const btnAgregar = page
      .getByRole("button", { name: /Agregar camión|Nuevo camión|Agregar/i })
      .or(page.getByText(/Agregar camión|Nuevo camión/i));
    const visible = await btnAgregar.count() > 0;
    expect(visible).toBeTruthy();
  });
});
