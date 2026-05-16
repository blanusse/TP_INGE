# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Login exitoso por rol >> transportista → redirige a /transportista
- Location: tests/e2e/auth.spec.ts:22:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/transportista/
Received string:  "https://cargaback.up.railway.app/login"
Timeout: 20000ms

Call log:
  - Expect "toHaveURL" with timeout 20000ms
    43 × unexpected value "https://cargaback.up.railway.app/login"

```

```yaml
- button "CargaBack"
- paragraph: La red logística más grande de Argentina.
- text: 3.400+ Transportistas activos 1.200+ Cargas por mes 94% Viajes con retorno 12 min Tiempo de match "
- paragraph: Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo.
- text: C Carlos M. Transportista · Rosario
- paragraph: © 2026 CargaBack · Argentina
- button "← Volver"
- heading "Iniciá sesión" [level=1]
- paragraph: Ingresá con tu email y contraseña
- text: Email
- textbox "Email":
  - /placeholder: tu@email.com
  - text: trans_test@cargaback.test
- text: Contraseña
- textbox "Tu contraseña": TestPass123!
- button "Mostrar"
- button "¿Olvidaste tu contraseña?"
- text: ⚠ Email o contraseña incorrectos.
- button "Ingresar"
- paragraph:
  - text: ¿No tenés cuenta?
  - button "Registrate gratis"
- alert
```

# Test source

```ts
  1   | /**
  2   |  * Tests de flujos de autenticación: login correcto, redirección por rol,
  3   |  * manejo de cuentas suspendidas/baneadas, recuperación de contraseña.
  4   |  */
  5   | import { test, expect } from "@playwright/test";
  6   | import { CREDS } from "../fixtures/credentials";
  7   | 
  8   | async function irAFormLogin(page: import("@playwright/test").Page) {
  9   |   await page.goto("/login");
  10  |   await page.getByText("Iniciar sesión").first().click();
  11  | }
  12  | 
  13  | test.describe("Login exitoso por rol", () => {
  14  |   test("dador → redirige a /dador", async ({ page }) => {
  15  |     await irAFormLogin(page);
  16  |     await page.getByLabel(/Email/i).fill(CREDS.dador.email);
  17  |     await page.locator('input[type="password"]').fill(CREDS.dador.password);
  18  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  19  |     await expect(page).toHaveURL(/\/dador/, { timeout: 20_000 });
  20  |   });
  21  | 
  22  |   test("transportista → redirige a /transportista", async ({ page }) => {
  23  |     await irAFormLogin(page);
  24  |     await page.getByLabel(/Email/i).fill(CREDS.transportista.email);
  25  |     await page.locator('input[type="password"]').fill(CREDS.transportista.password);
  26  |     await page.getByRole("button", { name: /Ingresar/i }).click();
> 27  |     await expect(page).toHaveURL(/\/transportista/, { timeout: 20_000 });
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  28  |   });
  29  | 
  30  |   test("flota → redirige a /flota", async ({ page }) => {
  31  |     await irAFormLogin(page);
  32  |     await page.getByLabel(/Email/i).fill(CREDS.flota.email);
  33  |     await page.locator('input[type="password"]').fill(CREDS.flota.password);
  34  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  35  |     await expect(page).toHaveURL(/\/flota/, { timeout: 20_000 });
  36  |   });
  37  | 
  38  |   test("empleado → redirige a /empleado", async ({ page }) => {
  39  |     await irAFormLogin(page);
  40  |     await page.getByLabel(/Email/i).fill(CREDS.empleado.email);
  41  |     await page.locator('input[type="password"]').fill(CREDS.empleado.password);
  42  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  43  |     await expect(page).toHaveURL(/\/empleado/, { timeout: 20_000 });
  44  |   });
  45  | 
  46  |   test("admin → redirige a /admin", async ({ page }) => {
  47  |     await irAFormLogin(page);
  48  |     await page.getByLabel(/Email/i).fill(CREDS.admin.email);
  49  |     await page.locator('input[type="password"]').fill(CREDS.admin.password);
  50  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  51  |     await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
  52  |   });
  53  | });
  54  | 
  55  | test.describe("Protección de roles cruzados", () => {
  56  |   test("dador autenticado no puede acceder a /transportista", async ({ page }) => {
  57  |     // Loguear como dador
  58  |     await irAFormLogin(page);
  59  |     await page.getByLabel(/Email/i).fill(CREDS.dador.email);
  60  |     await page.locator('input[type="password"]').fill(CREDS.dador.password);
  61  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  62  |     await page.waitForURL(/\/dador/, { timeout: 20_000 });
  63  |     // Intentar acceder a ruta de transportista
  64  |     await page.goto("/transportista");
  65  |     await expect(page).toHaveURL(/\/dador/, { timeout: 10_000 });
  66  |   });
  67  | 
  68  |   test("transportista autenticado no puede acceder a /dador", async ({ page }) => {
  69  |     await irAFormLogin(page);
  70  |     await page.getByLabel(/Email/i).fill(CREDS.transportista.email);
  71  |     await page.locator('input[type="password"]').fill(CREDS.transportista.password);
  72  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  73  |     await page.waitForURL(/\/transportista/, { timeout: 20_000 });
  74  |     await page.goto("/dador");
  75  |     await expect(page).toHaveURL(/\/transportista/, { timeout: 10_000 });
  76  |   });
  77  | 
  78  |   test("usuario no-admin no puede acceder a /admin", async ({ page }) => {
  79  |     await irAFormLogin(page);
  80  |     await page.getByLabel(/Email/i).fill(CREDS.dador.email);
  81  |     await page.locator('input[type="password"]').fill(CREDS.dador.password);
  82  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  83  |     await page.waitForURL(/\/dador/, { timeout: 20_000 });
  84  |     await page.goto("/admin");
  85  |     await expect(page).toHaveURL(/\/(dador|dashboard)/, { timeout: 10_000 });
  86  |   });
  87  | });
  88  | 
  89  | test.describe("Usuario ya logueado en /login", () => {
  90  |   test("dador logueado en /login → redirige a /dador sin formulario", async ({ page }) => {
  91  |     await irAFormLogin(page);
  92  |     await page.getByLabel(/Email/i).fill(CREDS.dador.email);
  93  |     await page.locator('input[type="password"]').fill(CREDS.dador.password);
  94  |     await page.getByRole("button", { name: /Ingresar/i }).click();
  95  |     await page.waitForURL(/\/dador/, { timeout: 20_000 });
  96  |     await page.goto("/login");
  97  |     await expect(page).toHaveURL(/\/dador/, { timeout: 10_000 });
  98  |   });
  99  | });
  100 | 
  101 | test.describe("Logout", () => {
  102 |   test("dador puede cerrar sesión y queda en landing o login", async ({ page }) => {
  103 |     await irAFormLogin(page);
  104 |     await page.getByLabel(/Email/i).fill(CREDS.dador.email);
  105 |     await page.locator('input[type="password"]').fill(CREDS.dador.password);
  106 |     await page.getByRole("button", { name: /Ingresar/i }).click();
  107 |     await page.waitForURL(/\/dador/, { timeout: 20_000 });
  108 | 
  109 |     // Buscar botón de cerrar sesión (puede estar en sidebar o menú)
  110 |     const btnSalir = page
  111 |       .getByRole("button", { name: /cerrar sesión|salir|logout/i })
  112 |       .or(page.getByText(/cerrar sesión|salir/i));
  113 |     if (await btnSalir.count() > 0) {
  114 |       await btnSalir.first().click();
  115 |       await expect(page).toHaveURL(/\/(login|$)/, { timeout: 15_000 });
  116 |     } else {
  117 |       // Si no hay botón visible, verificar que la sesión pueda expirar
  118 |       test.skip(true, "Botón de logout no encontrado en la UI actual");
  119 |     }
  120 |   });
  121 | });
  122 | 
  123 | test.describe("Ruta /dashboard — redirección inteligente", () => {
  124 |   test("dador en /dashboard → va a /dador", async ({ page }) => {
  125 |     await irAFormLogin(page);
  126 |     await page.getByLabel(/Email/i).fill(CREDS.dador.email);
  127 |     await page.locator('input[type="password"]').fill(CREDS.dador.password);
```