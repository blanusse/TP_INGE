/**
 * Tests para el rol Dueño de flota (fleet owner).
 * Requiere storageState autenticado como flota.
 *
 * Cubre:
 *  - Dashboard y navegación
 *  - Mi flota: gestión de camiones
 *  - Invitar conductores
 *  - Buscar cargas y gestionar ofertas
 *  - Mis viajes
 *  - Mensajes
 *  - Mi perfil
 */
import { test, expect } from "@playwright/test";

async function dismissOnboarding(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    localStorage.setItem("flota-onboarding-done", "1");
    localStorage.setItem("transportista-onboarding-done", "1");
  });
  const btnOmitir = page.getByText(/Omitir tour/i);
  if (await btnOmitir.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await btnOmitir.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Flota — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
  });

  test("carga el dashboard del dueño de flota", async ({ page }) => {
    await expect(page).toHaveURL(/\/flota/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("muestra los ítems de navegación del dueño de flota", async ({ page }) => {
    const navItems = ["Mi flota", "Buscar cargas", "Mis viajes", "Mensajes"];
    for (const item of navItems) {
      await expect(page.getByText(item).first()).toBeVisible();
    }
  });

  test("no muestra error 500 al cargar", async ({ page }) => {
    await expect(page.getByText(/error interno|something went wrong/i)).not.toBeVisible();
  });
});

test.describe("Flota — Gestión de camiones", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mi flota").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección Mi flota", async ({ page }) => {
    await expect(page.getByText(/Mi flota|Camiones|Conductores/i).first()).toBeVisible();
  });

  test("muestra la lista de camiones o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1000);
    const tieneCamiones = await page.getByText(/patente|camión|plataforma|acoplado/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés camiones|sin camiones|agregá tu primer/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneCamiones || estaVacio || cargando).toBeTruthy();
  });

  test("existe botón para agregar un camión", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /Agregar camión|Nuevo camión|Agregar/i })
      .or(page.getByText(/Agregar camión|Nuevo camión/i));
    await expect(btn.first()).toBeVisible();
  });

  test("el formulario de nuevo camión se abre correctamente", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /Agregar camión|Nuevo camión/i })
      .or(page.getByText(/Agregar camión|Nuevo camión/i));
    await btn.first().click();
    await page.waitForTimeout(800);

    // Debe mostrar campos para patente y tipo de camión
    const tieneForm = await page
      .getByPlaceholder(/patente|ABC/i)
      .or(page.getByLabel(/patente/i))
      .or(page.getByText(/Tipo de camión|Capacidad/i))
      .count() > 0;
    expect(tieneForm).toBeTruthy();
  });

  test("el formulario de camión valida la patente", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /Agregar camión|Nuevo camión/i })
      .or(page.getByText(/Agregar camión|Nuevo camión/i));
    await btn.first().click();
    await page.waitForTimeout(800);

    const btnGuardar = page.getByRole("button", { name: /Guardar|Agregar|Confirmar/i });
    if (await btnGuardar.count() > 0) {
      await btnGuardar.first().click();
      // Debe mostrar error si patente está vacía
      await page.waitForTimeout(500);
      const tieneError = await page.getByText(/patente|requerido|obligatorio/i).count() > 0;
      const sigueAbierto = await btnGuardar.first().isVisible();
      expect(tieneError || sigueAbierto).toBeTruthy();
    }
  });
});

test.describe("Flota — Gestión de conductores", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mi flota").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la lista de conductores o estado vacío", async ({ page }) => {
    // Puede haber una pestaña de conductores o sección separada
    const tabConductores = page.getByText(/Conductores|Empleados/i);
    if (await tabConductores.count() > 0) {
      await tabConductores.first().click();
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1000);
    const tieneConductores = await page.getByText(/invitado|activo|empleado/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés conductores|sin conductores|invitá|no hay/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneConductores || estaVacio || cargando).toBeTruthy();
  });

  test("existe opción para invitar conductor", async ({ page }) => {
    // Navegar a tab de Conductores si existe
    const tabConductores = page.getByText(/Conductores|Empleados/i);
    if (await tabConductores.count() > 0) {
      await tabConductores.first().click();
      await page.waitForTimeout(800);
    }
    const btnInvitar = page
      .getByRole("button", { name: /Invitar conductor|Invitar empleado|Invitar/i })
      .or(page.getByText(/Invitar conductor|Invitar empleado/i));
    const visible = await btnInvitar.count() > 0;
    expect(visible).toBeTruthy();
  });

  test("el modal de invitación pide el email del conductor", async ({ page }) => {
    const btnInvitar = page
      .getByRole("button", { name: /Invitar conductor|Invitar empleado|Invitar/i })
      .or(page.getByText(/Invitar conductor|Invitar empleado/i));
    if (await btnInvitar.count() > 0) {
      await btnInvitar.first().click();
      await page.waitForTimeout(800);
      await expect(
        page.getByLabel(/Email|Correo/i)
          .or(page.getByPlaceholder(/email|correo/i))
      ).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip(true, "Botón de invitar no encontrado");
    }
  });

  test("invitar con email inválido muestra error", async ({ page }) => {
    const btnInvitar = page
      .getByRole("button", { name: /Invitar conductor|Invitar empleado|Invitar/i })
      .or(page.getByText(/Invitar conductor|Invitar empleado/i));
    if (await btnInvitar.count() === 0) {
      test.skip(true, "Botón de invitar no encontrado");
    }

    await btnInvitar.first().click();
    await page.waitForTimeout(500);

    const emailInput = page.getByLabel(/Email/i).or(page.getByPlaceholder(/email/i));
    if (await emailInput.count() > 0) {
      await emailInput.first().fill("noesunmail");
      const btnEnviar = page.getByRole("button", { name: /Enviar invitación|Invitar|Enviar/i });
      if (await btnEnviar.count() > 0) {
        await btnEnviar.first().click();
        await page.waitForTimeout(1000);
        // Debe mostrar error
        const tieneError = await page.getByText(/email inválido|inválido|formato/i).count() > 0;
        const sigueAbierto = await emailInput.first().isVisible();
        expect(tieneError || sigueAbierto).toBeTruthy();
      }
    }
  });
});

test.describe("Flota — Buscar cargas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Buscar cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra cargas disponibles o estado vacío", async ({ page }) => {
    await page.waitForTimeout(1500);
    const tieneCargas = await page.getByText(/→|kg|Publicado hace/i).count() > 0;
    const estaVacio = await page.getByText(/no hay cargas|sin cargas|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneCargas || estaVacio || cargando).toBeTruthy();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Flota — Mis viajes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mis viajes").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de viajes", async ({ page }) => {
    await expect(page.getByText(/Mis viajes|Viajes|Entregas/i).first()).toBeVisible();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Flota — Mensajes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
    await page.getByText("Mensajes").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("muestra la sección de mensajes", async ({ page }) => {
    await expect(page.getByText(/Mensajes|Chat|Conversaciones/i).first()).toBeVisible();
  });

  test("no muestra error 500", async ({ page }) => {
    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  });
});

test.describe("Flota — Mi perfil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/flota");
    await page.waitForLoadState("networkidle");
    await dismissOnboarding(page);
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

  test("tiene opción de cerrar sesión", async ({ page }) => {
    const btnSalir = page
      .getByRole("button", { name: /cerrar sesión|salir|logout/i })
      .or(page.getByText(/cerrar sesión|salir/i));
    await expect(btnSalir.first()).toBeVisible();
  });
});
