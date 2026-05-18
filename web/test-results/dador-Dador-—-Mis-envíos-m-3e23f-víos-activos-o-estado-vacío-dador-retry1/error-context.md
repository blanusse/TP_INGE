# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dador.spec.ts >> Dador — Mis envíos >> muestra envíos activos o estado vacío
- Location: tests/e2e/dador.spec.ts:195:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "CargaBack" [ref=e5] [cursor=pointer]:
          - /url: /
        - navigation [ref=e6]:
          - button "Inicio" [ref=e7] [cursor=pointer]:
            - img [ref=e8]: 
            - generic [ref=e10]: Inicio
          - button "Mis cargas" [ref=e11] [cursor=pointer]:
            - img [ref=e12]: 
            - generic [ref=e14]: Mis cargas
          - button "Mis envios" [active] [ref=e15] [cursor=pointer]:
            - img [ref=e16]: 
            - generic [ref=e18]: Mis envios
          - button "Historial" [ref=e19] [cursor=pointer]:
            - img [ref=e20]: 
            - generic [ref=e22]: Historial
          - button "Facturación" [ref=e23] [cursor=pointer]:
            - img [ref=e24]: 
            - generic [ref=e26]: Facturación
          - button "Seguros" [ref=e27] [cursor=pointer]:
            - img [ref=e28]: 
            - generic [ref=e30]: Seguros
      - generic [ref=e31]:
        - button "Modo oscuro" [ref=e32] [cursor=pointer]:
          - img [ref=e33]: 
        - button "+ Publicar carga" [ref=e35] [cursor=pointer]
        - button "DT" [ref=e36] [cursor=pointer]
    - main [ref=e38]:
      - generic [ref=e39]:
        - heading "Mis envios" [level=1] [ref=e40]
        - paragraph [ref=e41]: Segui el estado de tus cargas en transito
      - generic [ref=e42]:
        - img [ref=e44]: 
        - generic [ref=e46]: No tenes envios en curso
        - generic [ref=e47]: Cuando asignes un transportista a una carga, el envio aparecera aca.
  - alert [ref=e48]
```

# Test source

```ts
  100 | });
  101 | 
  102 | test.describe("Dador — Publicar nueva carga", () => {
  103 |   test.beforeEach(async ({ page }) => {
  104 |     await page.goto("/dador");
  105 |     await page.waitForLoadState("networkidle");
  106 |     await dismissOnboarding(page);
  107 |     await page.getByText("Mis cargas").first().click();
  108 |     await page.waitForLoadState("networkidle");
  109 |   });
  110 | 
  111 |   test("existe botón para publicar nueva carga", async ({ page }) => {
  112 |     const btnNueva = page
  113 |       .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
  114 |       .or(page.getByText(/Nueva carga|Publicar carga/i));
  115 |     await expect(btnNueva.first()).toBeVisible();
  116 |   });
  117 | 
  118 |   test("el formulario de nueva carga se abre correctamente", async ({ page }) => {
  119 |     const btnNueva = page
  120 |       .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
  121 |       .or(page.getByText(/Nueva carga|Publicar carga/i));
  122 |     await btnNueva.first().click();
  123 | 
  124 |     // El formulario debe pedir ciudades de origen y destino
  125 |     await expect(
  126 |       page.getByPlaceholder(/origen|ciudad de retiro|retiro/i)
  127 |         .or(page.getByLabel(/origen|retiro|pickup/i))
  128 |     ).toBeVisible({ timeout: 10_000 });
  129 |   });
  130 | 
  131 |   test("el formulario valida campos requeridos", async ({ page }) => {
  132 |     const btnNueva = page
  133 |       .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
  134 |       .or(page.getByText(/Nueva carga|Publicar carga/i));
  135 |     await btnNueva.first().click();
  136 |     await page.waitForTimeout(1000);
  137 | 
  138 |     // Intentar enviar sin completar
  139 |     const btnPublicar = page.getByRole("button", { name: /Publicar|Guardar|Crear carga/i });
  140 |     if (await btnPublicar.count() > 0) {
  141 |       await btnPublicar.first().click();
  142 |       // Debe mostrar algún error de validación
  143 |       const tieneError = await page.getByText(/requerido|obligatorio|ingresá|campo/i).count() > 0;
  144 |       // O que el formulario no se cerró (sigue visible)
  145 |       expect(tieneError || await btnPublicar.isVisible()).toBeTruthy();
  146 |     }
  147 |   });
  148 | });
  149 | 
  150 | test.describe("Dador — Gestión de ofertas", () => {
  151 |   test.beforeEach(async ({ page }) => {
  152 |     await page.goto("/dador");
  153 |     await page.waitForLoadState("networkidle");
  154 |     await dismissOnboarding(page);
  155 |     await page.getByText("Mis cargas").first().click();
  156 |     await page.waitForLoadState("networkidle");
  157 |   });
  158 | 
  159 |   test("una carga con ofertas permite verlas", async ({ page }) => {
  160 |     // Buscar una carga que tenga el tab "Con ofertas" activo
  161 |     const tabConOfertas = page.getByText("Con ofertas").first();
  162 |     if (await tabConOfertas.isVisible()) {
  163 |       await tabConOfertas.click();
  164 |       await page.waitForLoadState("networkidle");
  165 | 
  166 |       const hayCargas = await page.getByText(/→/i).count() > 0;
  167 |       if (hayCargas) {
  168 |         // Click en la primera carga para ver detalle y ofertas
  169 |         await page.getByText(/→/i).first().click();
  170 |         await page.waitForTimeout(1000);
  171 |         // Debe mostrar ofertas
  172 |         await expect(
  173 |           page.getByText(/oferta|precio|transportista/i).first()
  174 |         ).toBeVisible({ timeout: 10_000 });
  175 |       } else {
  176 |         test.skip(true, "No hay cargas con ofertas para probar");
  177 |       }
  178 |     }
  179 |   });
  180 | });
  181 | 
  182 | test.describe("Dador — Mis envíos", () => {
  183 |   test.beforeEach(async ({ page }) => {
  184 |     await page.goto("/dador");
  185 |     await page.waitForLoadState("networkidle");
  186 |     await dismissOnboarding(page);
  187 |     await page.getByText("Mis envios").first().click();
  188 |     await page.waitForLoadState("networkidle");
  189 |   });
  190 | 
  191 |   test("muestra la sección de envíos", async ({ page }) => {
  192 |     await expect(page.getByText(/Mis envios|En tránsito|Envíos/i).first()).toBeVisible();
  193 |   });
  194 | 
  195 |   test("muestra envíos activos o estado vacío", async ({ page }) => {
  196 |     await page.waitForTimeout(1500);
  197 |     const tieneEnvios = await page.getByText(/En tránsito|código de entrega|en camino/i).count() > 0;
  198 |     const estaVacio = await page.getByText(/no tenés|sin envíos|todavía no|ningún envío/i).count() > 0;
  199 |     const cargando = await page.getByText(/cargando/i).count() > 0;
> 200 |     expect(tieneEnvios || estaVacio || cargando).toBeTruthy();
      |                                                  ^ Error: expect(received).toBeTruthy()
  201 |   });
  202 | });
  203 | 
  204 | test.describe("Dador — Historial", () => {
  205 |   test.beforeEach(async ({ page }) => {
  206 |     await page.goto("/dador");
  207 |     await page.waitForLoadState("networkidle");
  208 |     await dismissOnboarding(page);
  209 |     await page.getByText("Historial").first().click();
  210 |     await page.waitForLoadState("networkidle");
  211 |   });
  212 | 
  213 |   test("muestra la sección de historial", async ({ page }) => {
  214 |     await expect(page.getByText(/Historial|Cargas finalizadas|Completadas/i).first()).toBeVisible();
  215 |   });
  216 | 
  217 |   test("muestra viajes pasados o estado vacío", async ({ page }) => {
  218 |     const tieneHistorial = await page.getByText(/Entregado|Cancelado|Completado/i).count() > 0;
  219 |     const estaVacio = await page.getByText(/no hay|sin historial|todavía no completaste/i).count() > 0;
  220 |     expect(tieneHistorial || estaVacio).toBeTruthy();
  221 |   });
  222 | });
  223 | 
  224 | test.describe("Dador — Facturación", () => {
  225 |   test.beforeEach(async ({ page }) => {
  226 |     await page.goto("/dador");
  227 |     await page.waitForLoadState("networkidle");
  228 |     await dismissOnboarding(page);
  229 |     await page.getByText("Facturación").first().click();
  230 |     await page.waitForLoadState("networkidle");
  231 |   });
  232 | 
  233 |   test("muestra la sección de facturación", async ({ page }) => {
  234 |     await expect(page.getByText(/Facturación|Factura|Pagos|Comprobantes/i).first()).toBeVisible();
  235 |   });
  236 | 
  237 |   test("no muestra error 500", async ({ page }) => {
  238 |     await expect(page.getByText(/error interno|something went wrong/i)).not.toBeVisible();
  239 |   });
  240 | });
  241 | 
  242 | test.describe("Dador — Seguros", () => {
  243 |   test.beforeEach(async ({ page }) => {
  244 |     await page.goto("/dador");
  245 |     await page.waitForLoadState("networkidle");
  246 |     await dismissOnboarding(page);
  247 |     await page.getByText("Seguros").first().click();
  248 |     await page.waitForLoadState("networkidle");
  249 |   });
  250 | 
  251 |   test("muestra la sección de seguros", async ({ page }) => {
  252 |     await expect(page.getByText(/Seguros|Póliza|Cobertura/i).first()).toBeVisible();
  253 |   });
  254 | 
  255 |   test("muestra productos de seguro o estado vacío", async ({ page }) => {
  256 |     const tieneProductos = await page
  257 |       .getByText(/contratar|cobertura|prima|cotizar/i).count() > 0;
  258 |     const estaVacio = await page
  259 |       .getByText(/no hay seguros|sin seguros|todavía no/i).count() > 0;
  260 |     const cargando = await page.getByText(/cargando/i).count() > 0;
  261 |     expect(tieneProductos || estaVacio || cargando).toBeTruthy();
  262 |   });
  263 | 
  264 |   test("no muestra error 500", async ({ page }) => {
  265 |     await expect(page.getByText(/error interno del servidor/i)).not.toBeVisible();
  266 |   });
  267 | });
  268 | 
  269 | test.describe("Dador — Mi perfil", () => {
  270 |   test.beforeEach(async ({ page }) => {
  271 |     await page.goto("/dador");
  272 |     await page.waitForLoadState("networkidle");
  273 |     await dismissOnboarding(page);
  274 |     await page.getByText("Mi perfil").first().click();
  275 |     await page.waitForLoadState("networkidle");
  276 |   });
  277 | 
  278 |   test("muestra la sección de perfil", async ({ page }) => {
  279 |     await expect(page.getByText(/Mi perfil|Perfil|Cuenta/i).first()).toBeVisible();
  280 |   });
  281 | 
  282 |   test("muestra datos del usuario", async ({ page }) => {
  283 |     // Debe mostrar email, nombre u otro dato del usuario
  284 |     const tieneEmail = await page.getByText(/@/i).count() > 0;
  285 |     const tieneNombre = await page.getByText(/nombre|usuario|cuenta/i).count() > 0;
  286 |     expect(tieneEmail || tieneNombre).toBeTruthy();
  287 |   });
  288 | 
  289 |   test("tiene opción de cerrar sesión", async ({ page }) => {
  290 |     const btnSalir = page
  291 |       .getByRole("button", { name: /cerrar sesión|salir|logout/i })
  292 |       .or(page.getByText(/cerrar sesión|salir/i));
  293 |     await expect(btnSalir.first()).toBeVisible();
  294 |   });
  295 | });
  296 | 
```