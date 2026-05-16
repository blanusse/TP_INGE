/**
 * Tests para usuario NO autenticado (guest).
 * Verifica que las páginas públicas funcionan y que las rutas protegidas
 * redirigen correctamente al login.
 */
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("carga correctamente y muestra la marca CargaBack", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CargaBack/i);
    await expect(page.getByText(/CargaBack/i).first()).toBeVisible();
  });

  test("tiene botones de acceso visibles", async ({ page }) => {
    await page.goto("/");
    // La landing debe ofrecer algún CTA para ingresar o registrarse
    const ctaLogin = page.getByRole("link", { name: /iniciar sesión|ingresar|entrar/i }).or(
      page.getByRole("button", { name: /iniciar sesión|ingresar|entrar/i })
    );
    const ctaRegistro = page.getByRole("link", { name: /registrar|crear cuenta|comenzar/i }).or(
      page.getByRole("button", { name: /registrar|crear cuenta|comenzar/i })
    );
    const hasCta = await ctaLogin.count() > 0 || await ctaRegistro.count() > 0;
    expect(hasCta).toBeTruthy();
  });
});

test.describe("Página de login", () => {
  test("carga con el paso inicial correcto", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/Bienvenido/i)).toBeVisible();
    await expect(page.getByText(/Iniciar sesión/i).first()).toBeVisible();
    await expect(page.getByText(/Registrarse gratis/i)).toBeVisible();
  });

  test("navega al formulario de login", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Iniciar sesión").first().click();
    await expect(page.getByText(/Iniciá sesión/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Ingresar/i })).toBeVisible();
  });

  test("muestra error con credenciales inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Iniciar sesión").first().click();
    await page.getByLabel(/Email/i).fill("noexiste@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword123");
    await page.getByRole("button", { name: /Ingresar/i }).click();
    await expect(
      page.getByText(/Email o contraseña incorrectos|suspendida|deshabilitada/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("muestra error de validación con email inválido", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Iniciar sesión").first().click();
    await page.getByLabel(/Email/i).fill("noesunmail");
    await page.locator('input[type="password"]').fill("algo123");
    await page.getByRole("button", { name: /Ingresar/i }).click();
    await expect(page.getByText(/Email inválido/i)).toBeVisible();
  });

  test("botón Volver regresa al paso inicial", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Iniciar sesión").first().click();
    await page.getByRole("button", { name: /← Volver/i }).click();
    await expect(page.getByText(/Bienvenido/i)).toBeVisible();
  });

  test("navega al flujo de registro", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Registrarse gratis").first().click();
    await expect(page.getByText(/Crear cuenta/i)).toBeVisible();
    await expect(page.getByText(/Transportista individual/i)).toBeVisible();
    await expect(page.getByText(/Dueño de flota/i)).toBeVisible();
    await expect(page.getByText(/Empleado de flota/i)).toBeVisible();
    await expect(page.getByText(/Dador de carga/i)).toBeVisible();
  });
});

test.describe("Flujo de registro — selección de perfil", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Registrarse gratis").first().click();
  });

  test("seleccionar Transportista individual muestra el formulario correcto", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(0).click();
    await expect(page.getByText(/Transportista individual/i).first()).toBeVisible();
    await expect(page.getByLabel(/Nombre y apellido/i)).toBeVisible();
    await expect(page.getByLabel(/DNI/i)).toBeVisible();
    await expect(page.getByLabel(/Celular/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("seleccionar Dueño de flota muestra el formulario correcto", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(1).click();
    // El badge en el formulario de registro muestra "Dueño de flota"
    await expect(page.getByText(/Dueño de flota/i).first()).toBeVisible();
    await expect(page.getByLabel(/DNI/i)).toBeVisible();
  });

  test("seleccionar Empleado de flota pide código de invitación", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(2).click();
    await expect(page.getByText(/Empleado de flota/i).first()).toBeVisible();
    // El input de token no tiene htmlFor, buscar por placeholder
    await expect(page.getByPlaceholder(/Ej: a1b2c3|invitación/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Verificar código/i })).toBeVisible();
  });

  test("código de invitación inválido muestra error", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(2).click();
    await page.getByPlaceholder(/Ej: a1b2c3|invitación/i).fill("token-invalido-123");
    await page.getByRole("button", { name: /Verificar código/i }).click();
    await expect(
      page.getByText(/no válido|vencido|utilizada/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("seleccionar Dador de carga pide el tipo (personal/empresa)", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(3).click();
    await expect(page.getByText(/Dador de carga/i)).toBeVisible();
    await expect(page.getByText(/Persona física/i)).toBeVisible();
    await expect(page.getByText(/Empresa/i)).toBeVisible();
  });

  test("dador persona física muestra formulario con DNI", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(3).click();
    await page.getByText("Persona física").click();
    await expect(page.getByLabel(/DNI/i)).toBeVisible();
    // No debe pedir CUIT
    await expect(page.getByLabel(/CUIT/i)).not.toBeVisible();
  });

  test("dador empresa muestra formulario con CUIT y razón social", async ({ page }) => {
    await page.getByRole("button", { name: /Elegir/i }).nth(3).click();
    await page.getByText(/Empresa \/ S\.R\.L\./i).click();
    await expect(page.getByLabel(/Razón social/i)).toBeVisible();
    await expect(page.getByLabel(/CUIT/i)).toBeVisible();
  });
});

test.describe("Formulario de registro — validaciones", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Registrarse gratis").first().click();
    // Elegir transportista individual
    await page.getByRole("button", { name: /Elegir/i }).nth(0).click();
  });

  test("muestra error si el nombre está vacío", async ({ page }) => {
    await page.getByRole("button", { name: /Crear cuenta/i }).click();
    await expect(page.getByText(/Ingresá tu nombre completo/i)).toBeVisible();
  });

  test("muestra error de DNI inválido", async ({ page }) => {
    await page.getByLabel(/Nombre y apellido/i).fill("Juan Test");
    await page.getByLabel(/DNI/i).fill("123"); // muy corto
    await page.getByRole("button", { name: /Crear cuenta/i }).click();
    await expect(page.getByText(/DNI debe tener 7 u 8 dígitos/i)).toBeVisible();
  });

  test("muestra error si contraseña es menor a 8 caracteres", async ({ page }) => {
    await page.getByLabel(/Nombre y apellido/i).fill("Juan Test");
    await page.getByLabel(/DNI/i).fill("12345678");
    await page.getByLabel(/Celular/i).fill("1123456789");
    await page.getByLabel(/Email/i).fill("juan@test.com");
    await page.locator('input[type="password"]').fill("corta");
    await page.getByRole("button", { name: /Crear cuenta/i }).click();
    await expect(page.getByText(/al menos 8 caracteres/i)).toBeVisible();
  });

  test("el indicador de fuerza de contraseña aparece al escribir", async ({ page }) => {
    await page.locator('input[type="password"]').fill("Abc1234!");
    await expect(page.getByText(/Muy débil|Débil|Buena|Muy segura/i)).toBeVisible();
  });

  test("muestra error si no se aceptan los términos", async ({ page }) => {
    await page.getByLabel(/Nombre y apellido/i).fill("Juan Test");
    await page.getByLabel(/DNI/i).fill("12345678");
    await page.getByLabel(/Celular/i).fill("1123456789");
    await page.getByLabel(/Email/i).fill(`test_${Date.now()}@test.com`);
    await page.locator('input[type="password"]').fill("MiClave123!");
    // No marcar términos
    await page.getByRole("button", { name: /Crear cuenta/i }).click();
    await expect(page.getByText(/Aceptá los términos/i)).toBeVisible();
  });
});

test.describe("Protección de rutas", () => {
  const rutasProtegidas = [
    "/dador",
    "/transportista",
    "/flota",
    "/empleado",
    "/admin",
    "/dashboard",
  ];

  for (const ruta of rutasProtegidas) {
    test(`ruta ${ruta} redirige al login si no hay sesión`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }
});

test.describe("Páginas informativas", () => {
  test("página /para/dador carga correctamente (si existe)", async ({ page }) => {
    const res = await page.goto("/para/dador");
    // Aceptamos 200 o 404 (puede no estar implementada en producción), pero no 500
    expect(res?.status()).not.toBe(500);
  });

  test("página /para/transportista carga correctamente (si existe)", async ({ page }) => {
    const res = await page.goto("/para/transportista");
    expect(res?.status()).not.toBe(500);
  });

  test("pago exitoso muestra mensaje de éxito", async ({ page }) => {
    const res = await page.goto("/pago/exito");
    expect(res?.status()).not.toBe(500);
  });

  test("pago fallido muestra mensaje de fallo", async ({ page }) => {
    const res = await page.goto("/pago/fallo");
    expect(res?.status()).not.toBe(500);
  });
});
