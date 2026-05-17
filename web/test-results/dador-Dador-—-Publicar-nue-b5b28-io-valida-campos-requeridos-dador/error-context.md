# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dador.spec.ts >> Dador — Publicar nueva carga >> el formulario valida campos requeridos
- Location: tests/e2e/dador.spec.ts:110:7

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Publicar|Guardar|Crear carga/i }).first()
    - locator resolved to <button>+ Publicar carga</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div>…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div>…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    28 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div>…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms

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
          - button "Mis envios" [ref=e15] [cursor=pointer]:
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
        - button "+ Publicar carga" [active] [ref=e35] [cursor=pointer]
        - button "DT" [ref=e36] [cursor=pointer]
    - main [ref=e38]:
      - generic [ref=e39]:
        - heading "Mis cargas" [level=1] [ref=e40]
        - paragraph [ref=e41]: Publica cargas y gestiona ofertas de transportistas
      - generic [ref=e42]:
        - button "Publicadas 0" [ref=e43] [cursor=pointer]:
          - text: Publicadas
          - generic [ref=e44]: "0"
        - button "Asignadas 0" [ref=e45] [cursor=pointer]:
          - text: Asignadas
          - generic [ref=e46]: "0"
      - generic [ref=e47]:
        - img [ref=e49]: 
        - generic [ref=e51]: No tenes cargas publicadas
        - generic [ref=e52]: Publica tu primera carga para empezar a recibir ofertas.
    - generic [ref=e54]:
      - generic [ref=e55]:
        - generic [ref=e56]: Publicar nueva carga
        - button "×" [ref=e57] [cursor=pointer]
      - generic [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e61]: Origen *
            - textbox "Dirección exacta de retiro" [ref=e64]
          - generic [ref=e65]:
            - generic [ref=e66]: Destino *
            - textbox "Dirección exacta de entrega" [ref=e69]
        - generic [ref=e70]:
          - generic [ref=e71]:
            - generic [ref=e72]: Tipo de carga
            - combobox [ref=e73] [cursor=pointer]:
              - option "General" [selected]
              - option "Granel"
              - option "Refrigerado"
              - option "Plataforma"
              - option "Peligroso"
              - option "Frágil"
          - generic [ref=e74]:
            - generic [ref=e75]: Camión requerido
            - combobox [ref=e76] [cursor=pointer]:
              - option "Cualquiera" [selected]
              - option "Granelero"
              - option "Furgón cerrado"
              - option "Plataforma"
              - option "Refrigerado"
              - option "Cisterna"
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]: Peso estimado (kg) *
            - spinbutton [ref=e80]
          - generic [ref=e81]:
            - generic [ref=e82]: Precio base (ARS) *
            - spinbutton [ref=e83]
          - generic [ref=e84]:
            - generic [ref=e85]: Fecha de retiro *
            - textbox [ref=e86]
        - generic [ref=e87]:
          - button "Cancelar" [ref=e88] [cursor=pointer]
          - button "Publicar carga →" [ref=e89] [cursor=pointer]
  - alert [ref=e90]
```

# Test source

```ts
  20  |     await page.goto("/dador");
  21  |     await page.waitForLoadState("networkidle");
  22  |   });
  23  | 
  24  |   test("carga la página principal del dador", async ({ page }) => {
  25  |     await expect(page).toHaveURL(/\/dador/);
  26  |     // No debe redirigir a login
  27  |     await expect(page).not.toHaveURL(/\/login/);
  28  |   });
  29  | 
  30  |   test("muestra los ítems de navegación correctos", async ({ page }) => {
  31  |     const navItems = ["Inicio", "Mis cargas", "Mis envios", "Historial", "Facturación", "Seguros", "Mi perfil"];
  32  |     for (const item of navItems) {
  33  |       await expect(page.getByText(item).first()).toBeVisible();
  34  |     }
  35  |   });
  36  | 
  37  |   test("muestra la sección Inicio por defecto", async ({ page }) => {
  38  |     // La primera vista debe ser el home del dador
  39  |     await expect(page.getByText(/Inicio|Bienvenido|Mis cargas recientes/i).first()).toBeVisible();
  40  |   });
  41  | });
  42  | 
  43  | test.describe("Dador — Mis cargas", () => {
  44  |   test.beforeEach(async ({ page }) => {
  45  |     await page.goto("/dador");
  46  |     await page.waitForLoadState("networkidle");
  47  |     await page.getByText("Mis cargas").first().click();
  48  |     await page.waitForLoadState("networkidle");
  49  |   });
  50  | 
  51  |   test("muestra la sección de cargas", async ({ page }) => {
  52  |     await expect(page.getByText(/Mis cargas/i).first()).toBeVisible();
  53  |   });
  54  | 
  55  |   test("muestra las tabs de filtro de cargas", async ({ page }) => {
  56  |     const tabs = ["Todas", "Con ofertas", "Sin ofertas", "Confirmadas", "En tránsito"];
  57  |     for (const tab of tabs) {
  58  |       await expect(page.getByRole("button", { name: tab }).or(page.getByText(tab)).first()).toBeVisible();
  59  |     }
  60  |   });
  61  | 
  62  |   test("puede cambiar entre tabs sin error", async ({ page }) => {
  63  |     const tabs = ["Con ofertas", "Sin ofertas", "Confirmadas", "En tránsito", "Todas"];
  64  |     for (const tab of tabs) {
  65  |       const btn = page.getByRole("button", { name: tab }).or(page.getByText(tab)).first();
  66  |       if (await btn.isVisible()) {
  67  |         await btn.click();
  68  |         await page.waitForLoadState("networkidle");
  69  |         // No debe haber error visible
  70  |         await expect(page.getByText(/error interno|500/i)).not.toBeVisible();
  71  |       }
  72  |     }
  73  |   });
  74  | 
  75  |   test("muestra lista de cargas o estado vacío", async ({ page }) => {
  76  |     // Debe mostrar cargas o un mensaje indicando que no hay cargas
  77  |     const tieneCargas = await page.getByText(/→|kg|Publicado hace/i).count() > 0;
  78  |     const estaVacio = await page.getByText(/no tenés cargas|sin cargas|todavía no|Publicá tu primera/i).count() > 0;
  79  |     expect(tieneCargas || estaVacio).toBeTruthy();
  80  |   });
  81  | });
  82  | 
  83  | test.describe("Dador — Publicar nueva carga", () => {
  84  |   test.beforeEach(async ({ page }) => {
  85  |     await page.goto("/dador");
  86  |     await page.waitForLoadState("networkidle");
  87  |     await page.getByText("Mis cargas").first().click();
  88  |   });
  89  | 
  90  |   test("existe botón para publicar nueva carga", async ({ page }) => {
  91  |     const btnNueva = page
  92  |       .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
  93  |       .or(page.getByText(/Nueva carga|Publicar carga/i));
  94  |     await expect(btnNueva.first()).toBeVisible();
  95  |   });
  96  | 
  97  |   test("el formulario de nueva carga se abre correctamente", async ({ page }) => {
  98  |     const btnNueva = page
  99  |       .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
  100 |       .or(page.getByText(/Nueva carga|Publicar carga/i));
  101 |     await btnNueva.first().click();
  102 | 
  103 |     // El formulario debe pedir ciudades de origen y destino
  104 |     await expect(
  105 |       page.getByPlaceholder(/origen|ciudad de retiro|retiro/i)
  106 |         .or(page.getByLabel(/origen|retiro|pickup/i))
  107 |     ).toBeVisible({ timeout: 10_000 });
  108 |   });
  109 | 
  110 |   test("el formulario valida campos requeridos", async ({ page }) => {
  111 |     const btnNueva = page
  112 |       .getByRole("button", { name: /Nueva carga|Publicar carga|Publicar|Nueva/i })
  113 |       .or(page.getByText(/Nueva carga|Publicar carga/i));
  114 |     await btnNueva.first().click();
  115 |     await page.waitForTimeout(1000);
  116 | 
  117 |     // Intentar enviar sin completar
  118 |     const btnPublicar = page.getByRole("button", { name: /Publicar|Guardar|Crear carga/i });
  119 |     if (await btnPublicar.count() > 0) {
> 120 |       await btnPublicar.first().click();
      |                                 ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  121 |       // Debe mostrar algún error de validación
  122 |       const tieneError = await page.getByText(/requerido|obligatorio|ingresá|campo/i).count() > 0;
  123 |       // O que el formulario no se cerró (sigue visible)
  124 |       expect(tieneError || await btnPublicar.isVisible()).toBeTruthy();
  125 |     }
  126 |   });
  127 | });
  128 | 
  129 | test.describe("Dador — Gestión de ofertas", () => {
  130 |   test.beforeEach(async ({ page }) => {
  131 |     await page.goto("/dador");
  132 |     await page.waitForLoadState("networkidle");
  133 |     await page.getByText("Mis cargas").first().click();
  134 |     await page.waitForLoadState("networkidle");
  135 |   });
  136 | 
  137 |   test("una carga con ofertas permite verlas", async ({ page }) => {
  138 |     // Buscar una carga que tenga el tab "Con ofertas" activo
  139 |     const tabConOfertas = page.getByText("Con ofertas").first();
  140 |     if (await tabConOfertas.isVisible()) {
  141 |       await tabConOfertas.click();
  142 |       await page.waitForLoadState("networkidle");
  143 | 
  144 |       const hayCargas = await page.getByText(/→/i).count() > 0;
  145 |       if (hayCargas) {
  146 |         // Click en la primera carga para ver detalle y ofertas
  147 |         await page.getByText(/→/i).first().click();
  148 |         await page.waitForTimeout(1000);
  149 |         // Debe mostrar ofertas
  150 |         await expect(
  151 |           page.getByText(/oferta|precio|transportista/i).first()
  152 |         ).toBeVisible({ timeout: 10_000 });
  153 |       } else {
  154 |         test.skip(true, "No hay cargas con ofertas para probar");
  155 |       }
  156 |     }
  157 |   });
  158 | });
  159 | 
  160 | test.describe("Dador — Mis envíos", () => {
  161 |   test.beforeEach(async ({ page }) => {
  162 |     await page.goto("/dador");
  163 |     await page.waitForLoadState("networkidle");
  164 |     await page.getByText("Mis envios").first().click();
  165 |     await page.waitForLoadState("networkidle");
  166 |   });
  167 | 
  168 |   test("muestra la sección de envíos", async ({ page }) => {
  169 |     await expect(page.getByText(/Mis envios|En tránsito|Envíos/i).first()).toBeVisible();
  170 |   });
  171 | 
  172 |   test("muestra envíos activos o estado vacío", async ({ page }) => {
  173 |     const tieneEnvios = await page.getByText(/En tránsito|km|código de entrega/i).count() > 0;
  174 |     const estaVacio = await page.getByText(/no tenés envíos|sin envíos|todavía no/i).count() > 0;
  175 |     expect(tieneEnvios || estaVacio).toBeTruthy();
  176 |   });
  177 | });
  178 | 
  179 | test.describe("Dador — Historial", () => {
  180 |   test.beforeEach(async ({ page }) => {
  181 |     await page.goto("/dador");
  182 |     await page.waitForLoadState("networkidle");
  183 |     await page.getByText("Historial").first().click();
  184 |     await page.waitForLoadState("networkidle");
  185 |   });
  186 | 
  187 |   test("muestra la sección de historial", async ({ page }) => {
  188 |     await expect(page.getByText(/Historial|Cargas finalizadas|Completadas/i).first()).toBeVisible();
  189 |   });
  190 | 
  191 |   test("muestra viajes pasados o estado vacío", async ({ page }) => {
  192 |     const tieneHistorial = await page.getByText(/Entregado|Cancelado|Completado/i).count() > 0;
  193 |     const estaVacio = await page.getByText(/no hay|sin historial|todavía no completaste/i).count() > 0;
  194 |     expect(tieneHistorial || estaVacio).toBeTruthy();
  195 |   });
  196 | });
  197 | 
  198 | test.describe("Dador — Facturación", () => {
  199 |   test.beforeEach(async ({ page }) => {
  200 |     await page.goto("/dador");
  201 |     await page.waitForLoadState("networkidle");
  202 |     await page.getByText("Facturación").first().click();
  203 |     await page.waitForLoadState("networkidle");
  204 |   });
  205 | 
  206 |   test("muestra la sección de facturación", async ({ page }) => {
  207 |     await expect(page.getByText(/Facturación|Factura|Pagos|Comprobantes/i).first()).toBeVisible();
  208 |   });
  209 | 
  210 |   test("no muestra error 500", async ({ page }) => {
  211 |     await expect(page.getByText(/error interno|500|something went wrong/i)).not.toBeVisible();
  212 |   });
  213 | });
  214 | 
  215 | test.describe("Dador — Seguros", () => {
  216 |   test.beforeEach(async ({ page }) => {
  217 |     await page.goto("/dador");
  218 |     await page.waitForLoadState("networkidle");
  219 |     await page.getByText("Seguros").first().click();
  220 |     await page.waitForLoadState("networkidle");
```