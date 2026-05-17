# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: registro-completo.spec.ts >> Registro — Validaciones inline >> DADO términos sin aceptar CUANDO intenta registrar ENTONCES muestra error
- Location: tests/e2e/registro-completo.spec.ts:147:7

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByText('Persona física')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - button "CargaBack" [ref=e5] [cursor=pointer]:
        - generic [ref=e6]: CargaBack
      - generic [ref=e7]:
        - paragraph [ref=e8]: La red logística más grande de Argentina.
        - generic [ref=e9]:
          - generic [ref=e10]:
            - generic [ref=e11]: 3.400+
            - generic [ref=e12]: Transportistas activos
          - generic [ref=e13]:
            - generic [ref=e14]: 1.200+
            - generic [ref=e15]: Cargas por mes
          - generic [ref=e16]:
            - generic [ref=e17]: 94%
            - generic [ref=e18]: Viajes con retorno
          - generic [ref=e19]:
            - generic [ref=e20]: 12 min
            - generic [ref=e21]: Tiempo de match
        - generic [ref=e22]:
          - generic [ref=e23]: "\""
          - paragraph [ref=e24]: Antes volvía vacío de Buenos Aires siempre. Ahora en 20 minutos encuentro carga para el regreso. Cambió todo.
          - generic [ref=e25]:
            - generic [ref=e26]: C
            - generic [ref=e27]:
              - generic [ref=e28]: Carlos M.
              - generic [ref=e29]: Transportista · Rosario
      - paragraph [ref=e30]: © 2026 CargaBack · Argentina
    - generic [ref=e34]:
      - button "← Volver" [ref=e35] [cursor=pointer]
      - heading "Crear cuenta" [level=1] [ref=e36]
      - paragraph [ref=e37]: ¿Cuál describe mejor tu rol?
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - img [ref=e42]
            - generic [ref=e47]: Transportista individual
            - generic [ref=e48]:
              - img [ref=e50]
              - generic [ref=e52]: Buscá cargas y ofertá tu precio
            - generic [ref=e53]:
              - img [ref=e55]
              - generic [ref=e57]: Planificá viajes y optimizá rutas
            - generic [ref=e58]:
              - img [ref=e60]
              - generic [ref=e62]: Invitá conductores cuando crezcas
          - button "Elegir →" [ref=e64] [cursor=pointer]
        - generic [ref=e65]:
          - generic [ref=e66]:
            - img [ref=e68]
            - generic [ref=e71]: Dueño de flota
            - generic [ref=e72]:
              - img [ref=e74]
              - generic [ref=e76]: Gestioná camiones y conductores
            - generic [ref=e77]:
              - img [ref=e79]
              - generic [ref=e81]: Asigná cargas a tu equipo
            - generic [ref=e82]:
              - img [ref=e84]
              - generic [ref=e86]: Panel unificado de toda tu flota
          - button "Elegir →" [ref=e88] [cursor=pointer]
        - generic [ref=e89]:
          - generic [ref=e90]:
            - img [ref=e92]
            - generic [ref=e96]: Empleado de flota
            - generic [ref=e97]:
              - img [ref=e99]
              - generic [ref=e101]: Recibí viajes asignados por tu jefe
            - generic [ref=e102]:
              - img [ref=e104]
              - generic [ref=e106]: Accedé a tu perfil y documentación
            - generic [ref=e107]:
              - img [ref=e109]
              - generic [ref=e111]: Requiere código de invitación
          - button "Elegir →" [ref=e113] [cursor=pointer]
        - generic [ref=e114]:
          - generic [ref=e115]:
            - img [ref=e117]
            - generic [ref=e120]: Dador de carga
            - generic [ref=e121]:
              - img [ref=e123]
              - generic [ref=e125]: Publicá cargas en menos de 2 minutos
            - generic [ref=e126]:
              - img [ref=e128]
              - generic [ref=e130]: Recibí ofertas de transportistas verificados
            - generic [ref=e131]:
              - img [ref=e133]
              - generic [ref=e135]: Seguimiento en tiempo real
          - button "Elegir →" [ref=e137] [cursor=pointer]
      - paragraph [ref=e139]:
        - text: ¿Ya tenés cuenta?
        - button "Iniciá sesión" [ref=e140] [cursor=pointer]
  - alert [ref=e141]
```

# Test source

```ts
  11  | function irARegistro(page: import("@playwright/test").Page) {
  12  |   return page.goto("/login");
  13  | }
  14  | 
  15  | test.describe("Registro — Navegación inicial", () => {
  16  |   test("DADO guest CUANDO entra a /login ENTONCES ve opciones de Iniciar sesión y Registrarse", async ({ page }) => {
  17  |     await irARegistro(page);
  18  |     await expect(page.getByText("Iniciar sesión").first()).toBeVisible();
  19  |     await expect(page.getByText("Registrarse gratis").first()).toBeVisible();
  20  |   });
  21  | 
  22  |   test("DADO guest CUANDO clickea Registrarse gratis ENTONCES ve selección de perfil con 4 roles", async ({ page }) => {
  23  |     await irARegistro(page);
  24  |     await page.getByText("Registrarse gratis").first().click();
  25  | 
  26  |     await expect(page.getByText("Crear cuenta").first()).toBeVisible();
  27  |     await expect(page.getByText("Transportista individual")).toBeVisible();
  28  |     await expect(page.getByText("Dueño de flota")).toBeVisible();
  29  |     await expect(page.getByText("Empleado de flota")).toBeVisible();
  30  |     await expect(page.getByText("Dador de carga")).toBeVisible();
  31  |   });
  32  | });
  33  | 
  34  | test.describe("Registro — Dador personal (happy path)", () => {
  35  |   test.beforeEach(async ({ page }) => {
  36  |     await irARegistro(page);
  37  |     await page.getByText("Registrarse gratis").first().click();
  38  | 
  39  |     // Seleccionar Dador de carga
  40  |     const dadorCard = page.getByText("Dador de carga");
  41  |     await dadorCard.click();
  42  |     // Esperar pantalla de tipo dador
  43  |     await page.getByText("Persona física").waitFor();
  44  |   });
  45  | 
  46  |   test("DADO selección Dador CUANDO elige Persona física ENTONCES ve formulario con campos de persona", async ({ page }) => {
  47  |     await page.getByText("Persona física").click();
  48  | 
  49  |     await expect(page.getByText("Crear cuenta").first()).toBeVisible();
  50  |     await expect(page.locator("#nombre")).toBeVisible();
  51  |     await expect(page.locator("#dni")).toBeVisible();
  52  |     await expect(page.locator("#tel")).toBeVisible();
  53  |     await expect(page.locator("#email")).toBeVisible();
  54  |   });
  55  | 
  56  |   test("DADO formulario dador personal CUANDO completa datos válidos ENTONCES redirige a verify-email", async ({ page }) => {
  57  |     await page.getByText("Persona física").click();
  58  | 
  59  |     // Completar formulario
  60  |     await page.locator("#nombre").fill(`Test Dador ${UID}`);
  61  |     await page.locator("#dni").fill("40" + String(UID).slice(-6));
  62  |     await page.locator("#tel").fill("1199" + String(UID).slice(-6));
  63  |     await page.locator("#email").fill(`dador_e2e_${UID}@testmail.com`);
  64  |     await page.locator('input[type="password"]').fill("TestPass123!");
  65  |     await page.locator("#terminos").check();
  66  | 
  67  |     // Esperar que las validaciones async terminen (email/dni/tel disponibles)
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
> 111 |     await page.getByText("Persona física").click();
      |                                            ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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
  168 |     await expect(page.getByRole("button", { name: /Verificar código/i })).toBeVisible();
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