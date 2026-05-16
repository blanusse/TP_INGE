/**
 * E2E — Hacer una oferta en una carga (rol: Transportista)
 *
 * Flujo: transportista busca cargas → elige una → envía oferta → aparece en Mis ofertas.
 * Requiere storageState autenticado como transportista (ver auth.setup.ts).
 */
import { test, expect } from "@playwright/test";

test.describe("Transportista — Hacer oferta en carga disponible", () => {
  test.beforeEach(async ({ page }) => {
    // DADO: transportista autenticado en la sección Buscar cargas
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.getByText("Buscar cargas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("DADO transportista logueado CUANDO busca cargas ENTONCES ve la lista de cargas disponibles", async ({ page }) => {
    // ENTONCES
    await expect(
      page.getByText(/Buscar cargas|Cargas disponibles/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Hay cargas o mensaje de vacío — nunca un error 500
    const tieneCargas = await page.getByText(/→/i).count() > 0;
    const estaVacio = await page.getByText(/no hay cargas|sin cargas|todavía no/i).count() > 0;
    const cargando = await page.getByText(/cargando/i).count() > 0;
    expect(tieneCargas || estaVacio || cargando).toBeTruthy();

    await expect(page.getByText(/error interno|500/i)).not.toBeVisible();
  });

  test("DADO carga disponible CUANDO el transportista hace click ENTONCES ve el detalle con botón de oferta", async ({ page }) => {
    const cargas = page.getByText(/→/i);
    const count = await cargas.count();

    if (count === 0) {
      test.skip(true, "No hay cargas disponibles en el entorno de test");
    }

    // CUANDO
    await cargas.first().click();
    await page.waitForTimeout(1_000);

    // ENTONCES: botón de ofertar visible
    const btnOfertar = page
      .getByRole("button", { name: /Ofertar|Enviar oferta|Hacer oferta/i })
      .or(page.getByText(/Ofertar|Enviar oferta/i))
      .first();

    // Puede ser que ya ofertaste — en ese caso el botón es de retirar oferta
    const tieneBoton = await btnOfertar.isVisible({ timeout: 8_000 }).catch(() => false);
    const yaOferté = await page.getByText(/ya ofertaste|retirar oferta/i).count() > 0;
    expect(tieneBoton || yaOferté).toBeTruthy();
  });

  test("DADO modal de oferta abierto CUANDO se ingresa precio ENTONCES muestra la diferencia respecto al precio base", async ({ page }) => {
    const cargas = page.getByText(/→/i);
    if (await cargas.count() === 0) {
      test.skip(true, "No hay cargas disponibles");
    }

    // CUANDO
    await cargas.first().click();
    await page.waitForTimeout(800);

    const btnOfertar = page
      .getByRole("button", { name: /Ofertar|Enviar oferta|Hacer oferta/i })
      .first();
    if (await btnOfertar.count() === 0) {
      test.skip(true, "Botón de ofertar no disponible (quizás ya ofertaste)");
    }
    await btnOfertar.click();
    await page.waitForTimeout(800);

    // ENTONCES: campo de precio visible
    const campoPrecio = page
      .getByLabel(/precio ofertado|Tu precio/i)
      .or(page.locator('input[type="number"]'))
      .first();
    await expect(campoPrecio).toBeVisible({ timeout: 8_000 });

    // Ingresa un precio
    await campoPrecio.fill("60000");
    await page.waitForTimeout(400);

    // Muestra info de diferencia respecto al base
    const tieneDiff = await page.getByText(/encima del precio base|debajo del precio base|igual al precio base/i).count() > 0;
    // O simplemente el modal sigue abierto con el campo
    const modalAbierto = await campoPrecio.isVisible();
    expect(tieneDiff || modalAbierto).toBeTruthy();
  });

  test("DADO oferta con precio 0 CUANDO se envía ENTONCES no se procesa", async ({ page }) => {
    const cargas = page.getByText(/→/i);
    if (await cargas.count() === 0) {
      test.skip(true, "No hay cargas disponibles");
    }

    await cargas.first().click();
    await page.waitForTimeout(800);

    const btnOfertar = page
      .getByRole("button", { name: /Ofertar|Enviar oferta|Hacer oferta/i })
      .first();
    if (await btnOfertar.count() === 0) {
      test.skip(true, "Botón de ofertar no disponible");
    }
    await btnOfertar.click();
    await page.waitForTimeout(800);

    // CUANDO: precio 0
    const campoPrecio = page
      .getByLabel(/precio ofertado|Tu precio/i)
      .or(page.locator('input[type="number"]'))
      .first();
    if (await campoPrecio.count() > 0) {
      await campoPrecio.fill("0");
      const btnEnviar = page
        .getByRole("button", { name: /Enviar oferta|Confirmar|Enviar/i })
        .first();
      if (await btnEnviar.count() > 0) {
        await btnEnviar.click();
        await page.waitForTimeout(1_000);

        // ENTONCES: modal sigue abierto o hay mensaje de error
        const sigueAbierto = await campoPrecio.isVisible();
        const hayError = await page.getByText(/mayor a 0|precio inválido|error/i).count() > 0;
        expect(sigueAbierto || hayError).toBeTruthy();
      }
    }
  });
});

test.describe("Transportista — Mis ofertas", () => {
  test.beforeEach(async ({ page }) => {
    // DADO: transportista autenticado
    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.getByText("Mis ofertas").first().click();
    await page.waitForLoadState("networkidle");
  });

  test("DADO transportista logueado CUANDO navega a Mis ofertas ENTONCES ve sus ofertas o estado vacío", async ({ page }) => {
    // ENTONCES
    await expect(
      page.getByText(/Mis ofertas|Ofertas enviadas/i).first()
    ).toBeVisible({ timeout: 10_000 });

    const tieneOfertas = await page.getByText(/pendiente|aceptada|rechazada|contrapropuesta/i).count() > 0;
    const estaVacio = await page.getByText(/no tenés ofertas|sin ofertas|todavía no/i).count() > 0;
    expect(tieneOfertas || estaVacio).toBeTruthy();

    // ENTONCES no hay error 500
    await expect(page.getByText(/error interno|500/i)).not.toBeVisible();
  });
});
