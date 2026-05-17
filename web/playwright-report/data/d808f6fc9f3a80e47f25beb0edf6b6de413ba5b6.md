# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: registro-completo.spec.ts >> Registro — Empleado (requiere invitación) >> DADO selección Empleado ENTONCES pide código de invitación antes del formulario
- Location: tests/e2e/registro-completo.spec.ts:162:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Verificar código/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Verificar código/i })

```

```yaml
- button "CargaBack"
- paragraph: La red logística más grande de Argentina.
- text: 3.400+ Transportistas activos 1.200+ Cargas por mes 94% Viajes con retorno 12 min Tiempo de match "
- paragraph: Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo.
- text: C Carlos M. Transportista · Rosario
- paragraph: © 2026 CargaBack · Argentina
- button "← Volver"
- heading "Crear cuenta" [level=1]
- paragraph: ¿Cuál describe mejor tu rol?
- img
- text: Transportista individual
- img
- text: Buscá cargas y ofertá tu precio
- img
- text: Planificá viajes y optimizá rutas
- img
- text: Invitá conductores cuando crezcas
- button "Elegir →"
- img
- text: Dueño de flota
- img
- text: Gestioná camiones y conductores
- img
- text: Asigná cargas a tu equipo
- img
- text: Panel unificado de toda tu flota
- button "Elegir →"
- img
- text: Empleado de flota
- img
- text: Recibí viajes asignados por tu jefe
- img
- text: Accedé a tu perfil y documentación
- img
- text: Requiere código de invitación
- button "Elegir →"
- img
- text: Dador de carga
- img
- text: Publicá cargas en menos de 2 minutos
- img
- text: Recibí ofertas de transportistas verificados
- img
- text: Seguimiento en tiempo real
- button "Elegir →"
- paragraph:
  - text: ¿Ya tenés cuenta?
  - button "Iniciá sesión"
- alert
```

# Test source

```ts
  68  |     await page.waitForTimeout(1500);
  69  | 
  70  |     await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
  71  | 
  72  |     await expect(page).toHaveURL(/\/verify-email/, { timeout: 20_000 });
  73  |   });
  74  | });
  75  | 
  76  | test.describe("Registro — Dador empresa", () => {
  77  |   test("DADO selección Dador empresa CUANDO elige Empresa ENTONCES ve campos de CUIT y razón social", async ({ page }) => {
  78  |     await irARegistro(page);
  79  |     await page.getByText("Registrarse gratis").first().click();
  80  |     await page.getByText("Dador de carga").click();
  81  |     await page.getByText("Empresa / S.R.L.").click();
  82  | 
  83  |     await expect(page.locator("#rs")).toBeVisible();
  84  |     await expect(page.locator("#cuit")).toBeVisible();
  85  |   });
  86  | });
  87  | 
  88  | test.describe("Registro — Transportista", () => {
  89  |   test.beforeEach(async ({ page }) => {
  90  |     await irARegistro(page);
  91  |     await page.getByText("Registrarse gratis").first().click();
  92  |     await page.getByText("Transportista individual").click();
  93  |     // Esperar formulario
  94  |     await page.locator("#nombre").waitFor();
  95  |   });
  96  | 
  97  |   test("DADO formulario transportista ENTONCES muestra campo DNI obligatorio", async ({ page }) => {
  98  |     await expect(page.locator("#dni")).toBeVisible();
  99  |   });
  100 | 
  101 |   test("DADO formulario transportista ENTONCES muestra info sobre agregar camiones después", async ({ page }) => {
  102 |     await expect(page.getByText(/vas a poder agregar/i).or(page.getByText(/Mi flota/i)).first()).toBeVisible();
  103 |   });
  104 | });
  105 | 
  106 | test.describe("Registro — Validaciones inline", () => {
  107 |   test.beforeEach(async ({ page }) => {
  108 |     await irARegistro(page);
  109 |     await page.getByText("Registrarse gratis").first().click();
  110 |     await page.getByText("Dador de carga").click();
  111 |     await page.getByText("Persona física").click();
  112 |     await page.locator("#nombre").waitFor();
  113 |   });
  114 | 
  115 |   test("DADO formulario vacío CUANDO intenta crear cuenta ENTONCES muestra error de nombre", async ({ page }) => {
  116 |     await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
  117 |     await expect(page.getByText(/nombre/i).last()).toBeVisible();
  118 |   });
  119 | 
  120 |   test("DADO DNI inválido CUANDO llena 3 dígitos ENTONCES no marca como disponible", async ({ page }) => {
  121 |     await page.locator("#nombre").fill("Test");
  122 |     await page.locator("#dni").fill("123");
  123 |     // No debería mostrar "DNI disponible" con solo 3 dígitos
  124 |     await page.waitForTimeout(1000);
  125 |     await expect(page.getByText("DNI disponible")).not.toBeVisible();
  126 |   });
  127 | 
  128 |   test("DADO email inválido CUANDO escribe sin @ ENTONCES no marca como disponible", async ({ page }) => {
  129 |     await page.locator("#email").fill("emailsindominio");
  130 |     await page.waitForTimeout(1000);
  131 |     await expect(page.getByText("Email disponible")).not.toBeVisible();
  132 |   });
  133 | 
  134 |   test("DADO contraseña corta CUANDO intenta registrar ENTONCES muestra error de contraseña", async ({ page }) => {
  135 |     await page.locator("#nombre").fill("Test User");
  136 |     await page.locator("#dni").fill("40123456");
  137 |     await page.locator("#tel").fill("11991234567");
  138 |     await page.locator("#email").fill(`short_pwd_${UID}@testmail.com`);
  139 |     await page.locator('input[type="password"]').fill("123");
  140 |     await page.locator("#terminos").check();
  141 |     await page.waitForTimeout(1500);
  142 | 
  143 |     await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
  144 |     await expect(page.getByText(/contraseña debe tener al menos 8/i)).toBeVisible();
  145 |   });
  146 | 
  147 |   test("DADO términos sin aceptar CUANDO intenta registrar ENTONCES muestra error", async ({ page }) => {
  148 |     await page.locator("#nombre").fill("Test User");
  149 |     await page.locator("#dni").fill("40123456");
  150 |     await page.locator("#tel").fill("11991234567");
  151 |     await page.locator("#email").fill(`terms_${UID}@testmail.com`);
  152 |     await page.locator('input[type="password"]').fill("TestPass123!");
  153 |     // No checkea términos
  154 |     await page.waitForTimeout(1500);
  155 | 
  156 |     await page.getByRole("button", { name: /Crear cuenta|Registrarme/i }).click();
  157 |     await expect(page.getByText(/términos/i)).toBeVisible();
  158 |   });
  159 | });
  160 | 
  161 | test.describe("Registro — Empleado (requiere invitación)", () => {
  162 |   test("DADO selección Empleado ENTONCES pide código de invitación antes del formulario", async ({ page }) => {
  163 |     await irARegistro(page);
  164 |     await page.getByText("Registrarse gratis").first().click();
  165 |     await page.getByText("Empleado de flota").click();
  166 | 
  167 |     await expect(page.getByText("Código de invitación")).toBeVisible();
> 168 |     await expect(page.getByRole("button", { name: /Verificar código/i })).toBeVisible();
      |                                                                           ^ Error: expect(locator).toBeVisible() failed
  169 |   });
  170 | 
  171 |   test("DADO código inválido CUANDO verifica ENTONCES muestra error", async ({ page }) => {
  172 |     await irARegistro(page);
  173 |     await page.getByText("Registrarse gratis").first().click();
  174 |     await page.getByText("Empleado de flota").click();
  175 | 
  176 |     await page.getByPlaceholder(/a1b2c3d4/i).fill("token-invalido-12345");
  177 |     await page.getByRole("button", { name: /Verificar código/i }).click();
  178 | 
  179 |     await expect(page.getByText(/no válido|vencido|no encontrad/i)).toBeVisible({ timeout: 10_000 });
  180 |   });
  181 | });
  182 | 
```