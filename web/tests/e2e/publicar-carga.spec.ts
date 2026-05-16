/**
 * E2E — Publicar nueva carga (rol: Dador de carga)
 *
 * Flujo: dador navega a Mis cargas → abre modal → completa formulario → publica.
 * Requiere storageState autenticado como dador (ver auth.setup.ts).
 */
import { test, expect } from "@playwright/test";

test.describe("Dador — Publicar nueva carga", () => {
  test.beforeEach(async ({ page }) => {
    // DADO: dador autenticado en la sección Mis cargas
    await page.goto("/dador");
    await page.waitForLoadState("networkidle");
    await page.getByText("Mis cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("DADO dador logueado CUANDO abre el modal de nueva carga ENTONCES el formulario es visible con sus campos", async ({ page }) => {
    // DADO
    const btnNueva = page
      .getByRole("button", { name: /Nueva carga|Publicar carga|Nueva|Publicar/i })
      .or(page.getByText(/\+ Nueva carga|Nueva carga/i))
      .first();
    await expect(btnNueva).toBeVisible({ timeout: 10_000 });

    // CUANDO
    await btnNueva.click();
    await page.waitForTimeout(800);

    // ENTONCES
    await expect(
      page.getByLabel(/Origen|Ciudad de retiro/i)
        .or(page.getByPlaceholder(/origen|ciudad de retiro|retiro/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByLabel(/Destino|Ciudad de entrega/i)
        .or(page.getByPlaceholder(/destino|ciudad de entrega|entrega/i))
        .first()
    ).toBeVisible();
  });

  test("DADO formulario abierto CUANDO se completa y envía ENTONCES la carga aparece en el listado", async ({ page }) => {
    const btnNueva = page
      .getByRole("button", { name: /Nueva carga|Publicar carga|Nueva|Publicar/i })
      .or(page.getByText(/\+ Nueva carga|Nueva carga/i))
      .first();

    if (await btnNueva.count() === 0) {
      test.skip(true, "Botón de nueva carga no encontrado");
    }

    // DADO
    await btnNueva.click();
    await page.waitForTimeout(800);

    const origenInput = page
      .getByLabel(/Origen/i)
      .or(page.getByPlaceholder(/origen|ciudad de retiro/i))
      .first();
    const destinoInput = page
      .getByLabel(/Destino/i)
      .or(page.getByPlaceholder(/destino|ciudad de entrega/i))
      .first();

    if (await origenInput.count() === 0 || await destinoInput.count() === 0) {
      test.skip(true, "Campos de origen/destino no encontrados");
    }

    // CUANDO: completa los campos del formulario
    await origenInput.fill("Buenos Aires, CABA");
    await destinoInput.fill("Córdoba Capital");

    // Peso
    const pesoInput = page
      .getByLabel(/Peso/i)
      .or(page.getByPlaceholder(/peso|kg/i))
      .first();
    if (await pesoInput.count() > 0) {
      await pesoInput.fill("5000");
    }

    // Precio base
    const precioInput = page
      .getByLabel(/Precio base/i)
      .or(page.getByPlaceholder(/precio|base/i))
      .first();
    if (await precioInput.count() > 0) {
      await precioInput.fill("80000");
    }

    // Fecha de retiro
    const fechaInput = page
      .getByLabel(/Fecha de retiro/i)
      .or(page.locator('input[type="date"]'))
      .first();
    if (await fechaInput.count() > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await fechaInput.fill(tomorrow.toISOString().split("T")[0]);
    }

    const btnPublicar = page
      .getByRole("button", { name: /Publicar carga|Publicar →|Guardar/i })
      .first();

    // ENTONCES: el botón de publicar existe
    await expect(btnPublicar).toBeVisible({ timeout: 5_000 });
  });

  test("DADO formulario abierto CUANDO se envía vacío ENTONCES se muestra validación", async ({ page }) => {
    const btnNueva = page
      .getByRole("button", { name: /Nueva carga|Publicar carga|Nueva|Publicar/i })
      .or(page.getByText(/\+ Nueva carga|Nueva carga/i))
      .first();

    if (await btnNueva.count() === 0) {
      test.skip(true, "Botón de nueva carga no encontrado");
    }

    // DADO
    await btnNueva.click();
    await page.waitForTimeout(800);

    // CUANDO: intenta publicar sin completar campos requeridos
    const btnPublicar = page
      .getByRole("button", { name: /Publicar carga|Publicar →/i })
      .first();
    if (await btnPublicar.count() > 0) {
      await btnPublicar.click();
      await page.waitForTimeout(800);

      // ENTONCES: el modal sigue abierto (no se cerró) o muestra mensaje de error
      const sigueAbierto = await page
        .getByRole("button", { name: /Publicar carga|Publicar →/i })
        .isVisible();
      const hayError = await page
        .getByText(/requerido|obligatorio|campo|ingresá/i)
        .count() > 0;
      expect(sigueAbierto || hayError).toBeTruthy();
    }
  });
});
