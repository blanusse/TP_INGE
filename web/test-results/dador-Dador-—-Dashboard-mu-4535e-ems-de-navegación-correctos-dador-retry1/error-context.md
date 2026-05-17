# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dador.spec.ts >> Dador — Dashboard >> muestra los ítems de navegación correctos
- Location: tests/e2e/dador.spec.ts:30:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Mi perfil').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Mi perfil').first()

```

```yaml
- banner:
  - link "CargaBack":
    - /url: /
  - navigation:
    - button "Inicio"
    - button "Mis cargas"
    - button "Mis envios"
    - button "Historial"
    - button "Facturación"
    - button "Seguros"
  - button "Modo oscuro"
  - button "+ Publicar carga"
  - button "DT"
- main:
  - heading "Hola, Dador" [level=1]
  - paragraph: domingo, 17 de mayo
  - text: $ Gasto este mes $0  Cargas activas 0  Tiempo prom. asignación —  Ofertas pendientes 0
  - heading "Ofertas recientes" [level=3]
  - paragraph: No hay ofertas recientes
  - heading "Envio en curso" [level=3]
  - text:  No hay envios en curso
- alert
```

# Test source

```ts
  1   | /**
  2   |  * Tests para el rol Dador de carga (shipper).
  3   |  * Requiere storageState autenticado (ver auth.setup.ts).
  4   |  *
  5   |  * Cubre:
  6   |  *  - Dashboard / navegación principal
  7   |  *  - Mis cargas: listado, filtros, detalle
  8   |  *  - Publicar nueva carga
  9   |  *  - Gestión de ofertas recibidas
  10  |  *  - Mis envíos (cargas en tránsito)
  11  |  *  - Historial
  12  |  *  - Facturación
  13  |  *  - Seguros
  14  |  *  - Mi perfil
  15  |  */
  16  | import { test, expect } from "@playwright/test";
  17  | 
  18  | test.describe("Dador — Dashboard", () => {
  19  |   test.beforeEach(async ({ page }) => {
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
> 33  |       await expect(page.getByText(item).first()).toBeVisible();
      |                                                  ^ Error: expect(locator).toBeVisible() failed
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
  120 |       await btnPublicar.first().click();
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
```