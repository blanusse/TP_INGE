# Testing — Guía de configuración y ejecución

## Resumen de suites

| Suite | Framework | Ubicación | Entorno requerido |
|-------|-----------|-----------|-------------------|
| Unit tests (backend) | Jest + ts-jest | `api/src/**/*.spec.ts` | Solo Node — sin DB |
| E2E (frontend) | Playwright | `web/tests/e2e/*.spec.ts` | App corriendo (local o prod) |

---

## PARTE 1 — Jest (Unit tests, backend NestJS)

### Prerrequisitos

```bash
cd api
npm install
```

Todas las dependencias necesarias (`jest`, `ts-jest`, `@types/jest`, `@nestjs/testing`) ya están en `devDependencies`.

### Correr los tests

```bash
cd api

# Correr todos los unit tests
npm test

# Modo watch (re-corre al guardar)
npm run test:watch

# Con reporte de cobertura
npm run test:coverage
```

### Archivos de test existentes

```
api/src/loads/loads.service.spec.ts      — createLoad: happy path, sin shipper, sin DNI, precio 0
api/src/offers/offers.service.spec.ts    — submitOffer: happy path, carga no disponible, oferta duplicada, validaciones
                                           updateOffer: accept, oferta rechazada, no encontrada
api/src/payments/payments.service.spec.ts — createPayment: happy path, oferta no encontrada
                                            confirmDelivery: código correcto, incorrecto, ya usado, pago pendiente
```

### Notas importantes

- Los tests **no requieren base de datos ni variables de entorno**: usan mocks de todos los repositorios TypeORM.
- Los mocks siguen el orden exacto de las llamadas async del servicio. Si cambiás la lógica interna, actualizá los `mockResolvedValueOnce` en el mismo orden.
- La config de ts-jest en `package.json` fuerza `"module": "CommonJS"` para compatibilidad con Jest (el `tsconfig.json` del proyecto usa `nodenext`).

### Tests que requieren entorno real

Ninguno. Todos los tests de esta suite son unitarios con mocks.

---

## PARTE 2 — Playwright (E2E, frontend Next.js)

### Prerrequisitos

```bash
cd web
npm install
npx playwright install --with-deps chromium
```

### Variables de entorno para las credenciales de test

Creá el archivo `web/.env.test` (o exportalas en tu shell) con cuentas de test reales:

```env
TEST_DADOR_EMAIL=dador_test@cargaback.test
TEST_DADOR_PASS=TestPass123!
TEST_TRANS_EMAIL=trans_test@cargaback.test
TEST_TRANS_PASS=TestPass123!
TEST_FLOTA_EMAIL=flota_test@cargaback.test
TEST_FLOTA_PASS=TestPass123!
TEST_EMPLEADO_EMAIL=empleado_test@cargaback.test
TEST_EMPLEADO_PASS=TestPass123!
TEST_ADMIN_EMAIL=admin@cargaback.test
TEST_ADMIN_PASS=TestPass123!
```

> Las credenciales por defecto están hardcodeadas en `web/tests/fixtures/credentials.ts`.
> Si las cuentas no existen en el entorno, los tests fallarán en el paso de setup.

### URL base

Por defecto los tests corren contra `https://cargaback.up.railway.app` (producción).
Para correr contra local, exportá:

```bash
export BASE_URL=http://localhost:3000
```

### Generar sesiones autenticadas (paso previo obligatorio)

```bash
cd web
npx playwright test --project=setup
```

Esto crea los archivos `web/tests/fixtures/.auth/*.json` con las cookies de sesión.
Solo necesitás correrlo una vez (o cuando las sesiones expiren).

### Correr todos los tests E2E

```bash
cd web
npm run test:e2e
# o directamente:
npx playwright test
```

### Correr proyectos específicos

```bash
# Solo tests del dador
npx playwright test --project=dador

# Solo publicar carga
npx playwright test --project=publicar-carga

# Solo transportista hace oferta
npx playwright test --project=aceptar-oferta

# Flujo completo (usa dos contextos)
npx playwright test --project=flujo-completo

# Tests de guest (sin login)
npx playwright test --project=guest
```

### UI Mode (recomendado para debug)

```bash
cd web
npm run test:e2e:ui
```

### Ver reporte HTML

```bash
cd web
npm run test:e2e:report
```

### Archivos de test existentes

```
web/tests/e2e/
├── auth.spec.ts              — Registro y login
├── guest.spec.ts             — Navegación sin autenticar
├── dador.spec.ts             — Dashboard completo del dador
├── transportista.spec.ts     — Dashboard completo del transportista
├── flota.spec.ts             — Gestión de flota
├── empleado.spec.ts          — Dashboard empleado
├── admin.spec.ts             — Panel de administración
├── publicar-carga.spec.ts    — Flujo focalizado: publicar nueva carga
├── aceptar-oferta.spec.ts    — Flujo focalizado: hacer oferta como transportista
└── flujo-completo.spec.ts    — Flujo end-to-end con dos contextos (dador + transportista)

web/tests/fixtures/
├── auth.setup.ts             — Genera storageState para cada rol
└── credentials.ts            — Credenciales (overrideable con env vars)
```

### Tests que requieren entorno real

Todos los tests E2E requieren la app corriendo. Los tests de flujo (publicar-carga, aceptar-oferta, flujo-completo) usan `test.skip` automáticamente si no hay cargas disponibles en el entorno o si las sesiones no están generadas.

---

## Integración continua (CI)

Para correr en CI, configurar las variables de entorno de credenciales y:

```yaml
# Ejemplo GitHub Actions
- name: Install deps
  run: cd web && npm ci && npx playwright install --with-deps chromium

- name: Run setup
  run: cd web && npx playwright test --project=setup
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
    TEST_DADOR_EMAIL: ${{ secrets.TEST_DADOR_EMAIL }}
    TEST_DADOR_PASS: ${{ secrets.TEST_DADOR_PASS }}
    # ... resto de credenciales

- name: Run E2E tests
  run: cd web && npx playwright test --project=dador --project=transportista
```
