/**
 * Setup: autentica cada tipo de usuario y guarda el storageState.
 * Playwright lo reutiliza para los specs que declaran `dependencies: ["setup"]`.
 */
import { test as setup, expect } from "@playwright/test";
import { CREDS } from "./credentials";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(__dirname, ".auth");

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  // Paso inicial: elegir "Iniciar sesión"
  await page.getByText("Iniciar sesión").first().click();
  await page.getByLabel(/Email/i).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /Ingresar/i }).click();
  // Esperar redirección al dashboard
  await page.waitForURL(/\/(dador|transportista|flota|empleado|admin)/, {
    timeout: 20_000,
  });
}

setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
});

setup("autenticar dador", async ({ page }) => {
  const file = path.join(AUTH_DIR, "dador.json");
  if (fs.existsSync(file)) return;
  await loginAs(page, CREDS.dador.email, CREDS.dador.password);
  await expect(page).toHaveURL(/\/dador/);
  await page.evaluate(() => localStorage.setItem("dador-onboarding-done", "1"));
  await page.context().storageState({ path: file });
});

setup("autenticar transportista", async ({ page }) => {
  const file = path.join(AUTH_DIR, "transportista.json");
  if (fs.existsSync(file)) return;
  await loginAs(page, CREDS.transportista.email, CREDS.transportista.password);
  await expect(page).toHaveURL(/\/transportista/);
  await page.evaluate(() => localStorage.setItem("transportista-onboarding-done", "1"));
  await page.context().storageState({ path: file });
});

setup("autenticar flota", async ({ page }) => {
  const file = path.join(AUTH_DIR, "flota.json");
  if (fs.existsSync(file)) return;
  await loginAs(page, CREDS.flota.email, CREDS.flota.password);
  await expect(page).toHaveURL(/\/flota/);
  await page.context().storageState({ path: file });
});

setup("autenticar empleado", async ({ page }) => {
  const file = path.join(AUTH_DIR, "empleado.json");
  if (fs.existsSync(file)) return;
  await loginAs(page, CREDS.empleado.email, CREDS.empleado.password);
  await expect(page).toHaveURL(/\/empleado/);
  await page.context().storageState({ path: file });
});

setup("autenticar admin", async ({ page }) => {
  const file = path.join(AUTH_DIR, "admin.json");
  if (fs.existsSync(file)) return;
  await loginAs(page, CREDS.admin.email, CREDS.admin.password);
  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: file });
});
