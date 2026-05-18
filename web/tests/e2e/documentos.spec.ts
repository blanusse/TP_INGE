/**
 * E2E — Verificación de documentos (rol: Transportista)
 *
 * Cubre:
 *  - Navegación a Mi perfil → pestaña Documentos
 *  - Estado de verificación de DNI, licencia, RUCTT
 *  - Subida de archivos (simula con setInputFiles)
 *  - Verificación de identidad AFIP
 *  - Documentos de camiones (VTV, seguro, cédula verde)
 *
 * Requiere storageState autenticado como transportista.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(__dirname, "../fixtures/.auth");
const TRANS_AUTH = path.join(AUTH_DIR, "transportista.json");
const FIXTURES_DIR = path.join(__dirname, "../fixtures");

// Crear una imagen de test mínima si no existe
const TEST_IMAGE = path.join(FIXTURES_DIR, "test-doc.jpg");

test.beforeAll(() => {
  if (!fs.existsSync(TEST_IMAGE)) {
    // Crear un JPEG mínimo válido (1x1 pixel)
    const jpegMinimo = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
      0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
      0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
      0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync(TEST_IMAGE, jpegMinimo);
  }
});

test.describe("Documentos — Navegación a pestaña Documentos", () => {
  test.beforeEach(async ({ page }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }
  });

  test("DADO transportista CUANDO navega a Mi perfil ENTONCES ve badge de verificación", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");

    // Debe ver su perfil con badge de verificación
    await expect(
      page.getByText(/verificad|pendiente/i).first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();

    await ctx.close();
  });

  test("DADO perfil de transportista CUANDO clickea pestaña Documentos ENTONCES ve sección de documentos", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");

    // Click en pestaña Documentos
    await page.getByText("Documentos").first().click();
    await page.waitForTimeout(500);

    // Debe mostrar documentos personales
    await expect(
      page.getByText(/DNI|Registro de conducir|RUCTT/i).first()
    ).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});

test.describe("Documentos — Estado de documentos personales", () => {
  test("DADO pestaña Documentos ENTONCES muestra estado de DNI, licencia y RUCTT", async ({ browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }

    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
    await page.getByText("Documentos").first().click();
    await page.waitForTimeout(500);

    // Debe existir sección de DNI
    await expect(page.getByText("DNI").first()).toBeVisible();

    // Debe existir sección de Registro de conducir
    await expect(page.getByText("Registro de conducir").first()).toBeVisible();

    // Cada documento tiene estado (Verificado o Pendiente) o botón de subir
    const tieneEstados = (await page.getByText(/Verificado|Pendiente|Subir foto/i).count()) > 0;
    expect(tieneEstados).toBeTruthy();

    await ctx.close();
  });
});

test.describe("Documentos — Subida de archivo", () => {
  test("DADO documento DNI sin verificar CUANDO sube una imagen ENTONCES recibe respuesta del servidor", async ({ browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }

    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
    await page.getByText("Documentos").first().click();
    await page.waitForTimeout(500);

    // Buscar input de archivo para DNI
    const fileInputs = page.locator('input[type="file"][accept="image/*"]');
    const count = await fileInputs.count();

    if (count === 0) {
      test.skip(true, "No hay inputs de archivo visibles (todos los docs ya están verificados)");
    }

    // Subir imagen de test en el primer input disponible
    await fileInputs.first().setInputFiles(TEST_IMAGE);

    // Esperar respuesta (verificando o mensaje de resultado)
    await page.waitForTimeout(3000);

    // Debe mostrar algún resultado: verificado, no verificado, o error de formato
    const tieneRespuesta =
      (await page.getByText(/verificad|no parece ser|no coincide|correctamente|error/i).count()) > 0;
    expect(tieneRespuesta).toBeTruthy();

    await ctx.close();
  });
});

test.describe("Documentos — Verificación AFIP", () => {
  test("DADO transportista con DNI verificado CUANDO ve documentos ENTONCES aparece sección AFIP", async ({ browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }

    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
    await page.getByText("Documentos").first().click();
    await page.waitForTimeout(500);

    // Si el DNI está verificado, debe aparecer la sección AFIP
    const tieneAfip = (await page.getByText(/AFIP|Verificar identidad|Identidad verificada/i).count()) > 0;

    if (!tieneAfip) {
      test.skip(true, "El DNI no está verificado aún — sección AFIP no aparece");
    }

    await expect(
      page.getByText(/AFIP|identidad/i).first()
    ).toBeVisible();

    await ctx.close();
  });
});

test.describe("Documentos — Documentos de camiones", () => {
  test("DADO transportista con camiones CUANDO ve documentos ENTONCES muestra docs por camión", async ({ browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }

    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
    await page.getByText("Documentos").first().click();
    await page.waitForTimeout(500);

    // Si tiene camiones, debe mostrar sección "Mis camiones"
    const tieneCamiones = (await page.getByText(/Mis camiones/i).count()) > 0;

    if (!tieneCamiones) {
      test.skip(true, "Transportista no tiene camiones registrados");
    }

    // Para cada camión debe haber docs: Cédula verde, VTV, Seguro
    await expect(page.getByText(/Cédula verde|VTV|Seguro/i).first()).toBeVisible();

    await ctx.close();
  });

  test("DADO banner de documentación completa CUANDO todos verificados ENTONCES muestra mensaje verde", async ({ browser }) => {
    if (!fs.existsSync(TRANS_AUTH)) {
      test.skip(true, "Sesión de transportista no generada");
    }

    const ctx = await browser.newContext({ storageState: TRANS_AUTH });
    const page = await ctx.newPage();

    await page.goto("/transportista");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
    await page.getByText("Mi perfil").first().click();
    await page.waitForLoadState("networkidle");
    await page.getByText("Documentos").first().click();
    await page.waitForTimeout(500);

    const completo = (await page.getByText(/Documentación verificada/i).count()) > 0;

    if (completo) {
      await expect(page.getByText("Documentación verificada").first()).toBeVisible();
    } else {
      // Si no está completo, debe haber al menos un documento pendiente
      const hayPendientes = (await page.getByText(/Pendiente|Subir foto/i).count()) > 0;
      expect(hayPendientes).toBeTruthy();
    }

    await ctx.close();
  });
});
