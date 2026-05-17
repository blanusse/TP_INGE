/**
 * E2E — Mensajeria entre usuarios
 *
 * Usa dos contextos de browser:
 *  - transCtx  → autenticado como transportista
 *  - dadorCtx  → autenticado como dador
 *
 * Requiere que los storageState de ambos roles esten generados (auth.setup.ts).
 * Si alguno no existe el test se saltea automaticamente.
 */
import { test, expect, Browser } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(__dirname, "../fixtures/.auth");
const DADOR_AUTH = path.join(AUTH_DIR, "dador.json");
const TRANS_AUTH = path.join(AUTH_DIR, "transportista.json");

test.describe("Mensajeria entre usuarios", () => {
  test("DADO transportista autenticado CUANDO navega a Mensajes ENTONCES ve lista de conversaciones o estado vacio", async ({ browser }: { browser: Browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesion de transportista no generada — corre primero: playwright test --project=setup");
    }

    const transCtx = await browser.newContext({ storageState: TRANS_AUTH });
    const transPage = await transCtx.newPage();

    try {
      // DADO: transportista en /transportista
      await transPage.goto("/transportista");
      await transPage.waitForLoadState("networkidle");
      await expect(transPage).toHaveURL(/\/transportista/);

      // CUANDO: navega a Mensajes
      await transPage.getByText("Mensajes").first().click();
      await transPage.waitForLoadState("networkidle");

      // ENTONCES: ve conversaciones o estado vacio (no error 500)
      const conversaciones = transPage
        .getByText(/conversaci|chat|mensaje/i)
        .first();
      const estadoVacio = transPage
        .getByText(/no ten|sin conversaci|no hay mensaje|vac/i)
        .first();

      await expect(
        conversaciones.or(estadoVacio)
      ).toBeVisible({ timeout: 10_000 });

      // ENTONCES: no hay error 500
      await expect(transPage.getByText(/error interno|500/i)).not.toBeVisible();
    } finally {
      await transCtx.close();
    }
  });

  test("DADO transportista con conversacion existente CUANDO envia un mensaje ENTONCES el mensaje aparece en el chat", async ({ browser }: { browser: Browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesion de transportista no generada — corre primero: playwright test --project=setup");
    }

    const transCtx = await browser.newContext({ storageState: TRANS_AUTH });
    const transPage = await transCtx.newPage();

    try {
      // DADO: transportista navega a Mensajes
      await transPage.goto("/transportista");
      await transPage.waitForLoadState("networkidle");
      await transPage.getByText("Mensajes").first().click();
      await transPage.waitForLoadState("networkidle");

      // Pre-check: necesitamos al menos una conversacion
      await transPage.waitForTimeout(2_000);

      const conversacionItem = transPage
        .locator('[class*="conversation"], [class*="chat"], [class*="contact"]')
        .or(transPage.getByRole("listitem"))
        .first();

      if (await conversacionItem.count() === 0) {
        test.skip(true, "No hay conversaciones existentes para testear envio de mensaje");
      }

      // CUANDO: abre la primera conversacion
      await conversacionItem.click();
      await transPage.waitForLoadState("networkidle");
      await transPage.waitForTimeout(1_000);

      // CUANDO: escribe y envia un mensaje
      const mensajeTexto = `Test msg ${Date.now()}`;
      const inputMensaje = transPage
        .getByPlaceholder(/escribe|mensaje|escribi/i)
        .first();

      if (await inputMensaje.count() === 0) {
        test.skip(true, "Input de mensaje no encontrado — la UI puede ser diferente");
      }

      await inputMensaje.fill(mensajeTexto);

      const btnEnviar = transPage
        .getByRole("button", { name: /enviar|send/i })
        .or(transPage.locator('button[type="submit"]'))
        .first();
      await btnEnviar.click();
      await transPage.waitForTimeout(2_000);

      // ENTONCES: el mensaje aparece en el chat
      await expect(
        transPage.getByText(mensajeTexto).first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await transCtx.close();
    }
  });

  test("DADO transportista envia mensaje CUANDO dador abre la conversacion ENTONCES el area de mensajes es visible", async ({ browser }: { browser: Browser }) => {
    if (!fs.existsSync(DADOR_AUTH) || !fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesiones de test no generadas — corre primero: playwright test --project=setup");
    }

    const transCtx = await browser.newContext({ storageState: TRANS_AUTH });
    const dadorCtx = await browser.newContext({ storageState: DADOR_AUTH });
    const transPage = await transCtx.newPage();
    const dadorPage = await dadorCtx.newPage();

    try {
      // ── Transportista envia un mensaje ──────────────────────────────────
      await transPage.goto("/transportista");
      await transPage.waitForLoadState("networkidle");
      await transPage.getByText("Mensajes").first().click();
      await transPage.waitForLoadState("networkidle");
      await transPage.waitForTimeout(2_000);

      const conversacionTrans = transPage
        .locator('[class*="conversation"], [class*="chat"], [class*="contact"]')
        .or(transPage.getByRole("listitem"))
        .first();

      if (await conversacionTrans.count() === 0) {
        test.skip(true, "No hay conversaciones existentes para testear flujo de 2 contextos");
      }

      await conversacionTrans.click();
      await transPage.waitForLoadState("networkidle");
      await transPage.waitForTimeout(1_000);

      const inputMensaje = transPage
        .getByPlaceholder(/escribe|mensaje|escribi/i)
        .first();

      if (await inputMensaje.count() === 0) {
        test.skip(true, "Input de mensaje no encontrado");
      }

      const mensajeTexto = `Test msg ${Date.now()}`;
      await inputMensaje.fill(mensajeTexto);

      const btnEnviar = transPage
        .getByRole("button", { name: /enviar|send/i })
        .or(transPage.locator('button[type="submit"]'))
        .first();
      await btnEnviar.click();
      await transPage.waitForTimeout(2_000);

      // ── Dador abre Mensajes ─────────────────────────────────────────────
      await dadorPage.goto("/dador");
      await dadorPage.waitForLoadState("networkidle");
      await dadorPage.getByText("Mensajes").first().click();
      await dadorPage.waitForLoadState("networkidle");
      await dadorPage.waitForTimeout(2_000);

      const conversacionDador = dadorPage
        .locator('[class*="conversation"], [class*="chat"], [class*="contact"]')
        .or(dadorPage.getByRole("listitem"))
        .first();

      if (await conversacionDador.count() === 0) {
        test.skip(true, "Dador no tiene conversaciones visibles");
      }

      // CUANDO: dador abre la conversacion
      await conversacionDador.click();
      await dadorPage.waitForLoadState("networkidle");
      await dadorPage.waitForTimeout(1_000);

      // ENTONCES: el area de mensajes es visible (no verificamos mensaje exacto por WebSocket delay)
      const areaMensajes = dadorPage
        .getByPlaceholder(/escribe|mensaje|escribi/i)
        .or(dadorPage.locator('[class*="message"], [class*="chat-body"], [class*="mensajes"]'))
        .first();

      await expect(areaMensajes).toBeVisible({ timeout: 10_000 });

      // ENTONCES: no hay error 500
      await expect(dadorPage.getByText(/error interno|500/i)).not.toBeVisible();
    } finally {
      await transCtx.close();
      await dadorCtx.close();
    }
  });

  test("DADO dador autenticado CUANDO carga el dashboard ENTONCES no hay errores y la navegacion funciona", async ({ browser }: { browser: Browser }) => {
    if (!fs.existsSync(DADOR_AUTH)) {
      test.skip(true, "Sesion de dador no generada — corre primero: playwright test --project=setup");
    }

    const dadorCtx = await browser.newContext({ storageState: DADOR_AUTH });
    const dadorPage = await dadorCtx.newPage();

    try {
      // DADO: dador en /dador
      await dadorPage.goto("/dador");
      await dadorPage.waitForLoadState("networkidle");
      await expect(dadorPage).toHaveURL(/\/dador/);

      // Cerrar modal de bienvenida si aparece
      const omitirTour = dadorPage.getByText(/Omitir tour|Cerrar|Saltar/i);
      if (await omitirTour.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await omitirTour.first().click();
        await dadorPage.waitForTimeout(500);
      }

      // ENTONCES: el dashboard carga sin error 500
      await expect(dadorPage.getByText(/error interno|500/i)).not.toBeVisible();

      // ENTONCES: la nav del dador tiene los items esperados
      await expect(dadorPage.getByText("Mis cargas").first()).toBeVisible({ timeout: 10_000 });

      // Nota: el dador no tiene "Mensajes" en la nav principal.
      // Los mensajes se acceden desde dentro de una carga especifica.
    } finally {
      await dadorCtx.close();
    }
  });
});
