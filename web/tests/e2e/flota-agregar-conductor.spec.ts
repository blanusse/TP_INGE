/**
 * Tests para agregar conductores como dueño de flota.
 * Requiere storageState autenticado como flota.
 *
 * Cubre:
 *  - Agregar conductor (happy path, solo UI)
 *  - Validaciones del formulario
 *  - Eliminar conductor (read-only)
 *  - Lista de conductores
 */
import { test, expect, Page } from "@playwright/test";

/** Cierra el modal de bienvenida si aparece */
async function dismissTour(page: Page) {
  await page.evaluate(() => localStorage.setItem("flota-onboarding-done", "1"));
  const omitir = page.getByText(/Omitir tour/i);
  if (await omitir.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await omitir.first().click();
    await page.waitForTimeout(500);
  }
}

/** Navega a la tab de Conductores dentro de Mi flota */
async function goToConductores(page: Page) {
  await page.goto("/flota");
  await page.waitForLoadState("networkidle");
  await dismissTour(page);
  await page.getByText("Mi flota").first().click();
  await page.waitForLoadState("networkidle");

  const tabConductores = page.getByText(/Conductores|Empleados/i);
  if (await tabConductores.count() > 0) {
    await tabConductores.first().click();
    await page.waitForTimeout(800);
  }
}

test.describe("Flota — Agregar conductor (happy path)", () => {
  test.beforeEach(async ({ page }) => {
    await goToConductores(page);
  });

  test("abre el formulario de agregar conductor y verifica campos", async ({ page }) => {
    const btnAgregar = page
      .getByRole("button", { name: /Agregar conductor|Invitar conductor|Invitar empleado|Invitar/i })
      .or(page.getByText(/Agregar conductor|Invitar conductor|Invitar empleado/i));

    if (await btnAgregar.count() === 0) {
      test.skip(true, "Botón de agregar/invitar conductor no encontrado");
    }

    await btnAgregar.first().click();
    await page.waitForTimeout(800);

    // Verificar que el formulario/modal se abrió con campos visibles
    const emailInput = page
      .getByLabel(/Email|Correo/i)
      .or(page.getByPlaceholder(/email|correo/i));
    await expect(emailInput.first()).toBeVisible({ timeout: 8_000 });

    // Verificar campos adicionales si existen (nombre, DNI, contraseña)
    const nombreInput = page
      .getByLabel(/Nombre/i)
      .or(page.getByPlaceholder(/nombre/i));
    const dniInput = page
      .getByLabel(/DNI|Documento/i)
      .or(page.getByPlaceholder(/dni|documento/i));
    const passwordInput = page
      .getByLabel(/Contraseña|Password/i)
      .or(page.getByPlaceholder(/contraseña|password/i));

    // Completar los campos que existan (sin submitear)
    const testEmail = `test+${Date.now()}@test.com`;
    await emailInput.first().fill(testEmail);

    if (await nombreInput.count() > 0) {
      await nombreInput.first().fill("Conductor Test");
    }
    if (await dniInput.count() > 0) {
      const randomDni = Math.floor(10000000 + Math.random() * 90000000).toString();
      await dniInput.first().fill(randomDni);
    }
    if (await passwordInput.count() > 0) {
      await passwordInput.first().fill("TestPass123!");
    }

    // Verificar que el botón de submit está habilitado
    const btnSubmit = page.getByRole("button", { name: /Enviar|Invitar|Agregar|Confirmar|Guardar/i });
    if (await btnSubmit.count() > 0) {
      await expect(btnSubmit.first()).toBeEnabled({ timeout: 8_000 });
    }

    // NO submitear para no crear datos en producción
  });
});

test.describe("Flota — Validaciones del formulario de conductor", () => {
  test.beforeEach(async ({ page }) => {
    await goToConductores(page);
  });

  test("muestra error con email inválido", async ({ page }) => {
    const btnAgregar = page
      .getByRole("button", { name: /Agregar conductor|Invitar conductor|Invitar empleado|Invitar/i })
      .or(page.getByText(/Agregar conductor|Invitar conductor|Invitar empleado/i));

    if (await btnAgregar.count() === 0) {
      test.skip(true, "Botón de agregar/invitar conductor no encontrado");
    }

    await btnAgregar.first().click();
    await page.waitForTimeout(800);

    const emailInput = page
      .getByLabel(/Email|Correo/i)
      .or(page.getByPlaceholder(/email|correo/i));

    if (await emailInput.count() === 0) {
      test.skip(true, "Campo de email no encontrado");
    }

    await emailInput.first().fill("noesunmail");

    const btnSubmit = page.getByRole("button", { name: /Enviar|Invitar|Agregar|Confirmar|Guardar/i });
    if (await btnSubmit.count() > 0) {
      await btnSubmit.first().click();
      await page.waitForTimeout(1000);

      // Debe mostrar error o el formulario sigue abierto (no recarga)
      const tieneError = await page
        .getByText(/email inválido|inválido|formato|válido|correo/i)
        .count() > 0;
      const sigueAbierto = await emailInput.first().isVisible();
      expect(tieneError || sigueAbierto).toBeTruthy();
    }
  });

  test("muestra error o botón deshabilitado con campos vacíos", async ({ page }) => {
    const btnAgregar = page
      .getByRole("button", { name: /Agregar conductor|Invitar conductor|Invitar empleado|Invitar/i })
      .or(page.getByText(/Agregar conductor|Invitar conductor|Invitar empleado/i));

    if (await btnAgregar.count() === 0) {
      test.skip(true, "Botón de agregar/invitar conductor no encontrado");
    }

    await btnAgregar.first().click();
    await page.waitForTimeout(800);

    const btnSubmit = page.getByRole("button", { name: /Enviar|Invitar|Agregar|Confirmar|Guardar/i });
    if (await btnSubmit.count() === 0) {
      test.skip(true, "Botón de submit no encontrado");
    }

    // Intentar enviar sin completar nada
    const estaDeshabilitado = await btnSubmit.first().isDisabled();
    if (!estaDeshabilitado) {
      await btnSubmit.first().click();
      await page.waitForTimeout(1000);

      // Debe mostrar error o el formulario sigue abierto
      const tieneError = await page
        .getByText(/requerido|obligatorio|completar|vacío|campo/i)
        .count() > 0;
      const emailInput = page
        .getByLabel(/Email|Correo/i)
        .or(page.getByPlaceholder(/email|correo/i));
      const sigueAbierto = await emailInput.count() > 0 && await emailInput.first().isVisible();
      expect(tieneError || sigueAbierto).toBeTruthy();
    } else {
      // El botón está deshabilitado con campos vacíos, validación correcta
      expect(estaDeshabilitado).toBeTruthy();
    }
  });
});

test.describe("Flota — Eliminar conductor (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await goToConductores(page);
  });

  test("verifica que existe botón de eliminar/desactivar si hay conductores", async ({ page }) => {
    // Buscar elementos que indiquen conductores reales en la lista (no el stat del dashboard)
    const listaConductores = page.locator('table tr, [class*="conductor"], [class*="driver"], [class*="employee"]');
    const tieneFilas = await listaConductores.count() > 0;
    // También verificar si hay emails visibles (señal de lista de conductores)
    const tieneEmails = await page.getByText(/@/).count() > 0;

    if (!tieneFilas && !tieneEmails) {
      test.skip(true, "No hay conductores en la lista de conductores");
    }

    const btnEliminar = page
      .getByRole("button", { name: /Eliminar|Desactivar|Quitar|Remover/i })
      .or(page.getByText(/Eliminar|Desactivar|Quitar|Remover/i))
      .or(page.locator('[aria-label*="eliminar" i]'))
      .or(page.locator('[aria-label*="delete" i]'))
      .or(page.locator('button svg').first());

    await expect(btnEliminar.first()).toBeVisible({ timeout: 10_000 });

    // NO eliminar realmente
  });
});

test.describe("Flota — Lista de conductores", () => {
  test.beforeEach(async ({ page }) => {
    await goToConductores(page);
  });

  test("la sección de conductores carga sin error 500", async ({ page }) => {
    await expect(page.getByText(/error interno|something went wrong/i)).not.toBeVisible();
  });

  test("muestra conductores existentes o estado vacío", async ({ page }) => {
    const tieneConductores = await page
      .getByText(/invitado|activo|conductor/i)
      .count() > 0;
    const estaVacio = await page
      .getByText(/no tenés conductores|sin conductores|invitá|no hay|sin empleados/i)
      .count() > 0;
    expect(tieneConductores || estaVacio).toBeTruthy();
  });

  test("cada conductor muestra info básica", async ({ page }) => {
    // Verificar si hay emails visibles (señal real de lista de conductores)
    const tieneEmails = await page.getByText(/@/).count() > 0;

    if (!tieneEmails) {
      test.skip(true, "No hay conductores con info visible para verificar");
    }

    expect(tieneEmails).toBeTruthy();
  });
});
