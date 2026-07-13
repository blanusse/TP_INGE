# CargaBack

Marketplace de fletes de Argentina: conecta **dadores de carga** con **transportistas** (individuales, dueños de flota y empleados), con pagos vía MercadoPago, chat en tiempo real, verificación de identidad (Veriff) y panel de administración.

**Deploy:** https://cargaback.up.railway.app

TP final — Ingeniería de Software 1, ITBA.

---

## Arquitectura

Monorepo con tres apps independientes:

```
TP_INGE/
├── api/      NestJS 11 + TypeORM + PostgreSQL + WebSockets (Socket.IO)
├── web/      Next.js (App Router) + NextAuth + Tailwind + Playwright E2E
└── mobile/   React Native + Expo (SDK 54)
```

**Servicios externos:** MercadoPago (pagos + OAuth), Veriff (verificación de identidad), Resend + Nodemailer (mails), Google Cloud Vision (OCR de DNI), OSRM (ruteo del mapa).

**Deploy:** API en Railway (nixpacks), web en Vercel, mobile por Expo Go.

---

## Roles

| Rol | Descripción | Ruta web |
|-----|-------------|----------|
| **Dador de carga** | Publica cargas, recibe ofertas, paga y califica | `/dador` |
| **Transportista individual** | Camionero solo, busca cargas y ofrece | `/transportista` |
| **Dueño de flota** | Gestiona camiones y conductores; ofrece asignando conductor | `/flota` |
| **Empleado de flota** | Ejecuta viajes asignados por su empleador | `/empleado` |
| **Admin** | Panel de retiros, reportes, suspensión/baneo de usuarios | `/admin` |

---

## Flujo end-to-end

1. Dador publica carga (origen, destino, tipo, precio, fechas)
2. Transportistas ven la carga y envían ofertas
3. Dador acepta una oferta → se genera el viaje
4. Dador paga vía MercadoPago (fondos retenidos)
5. Transportista actualiza estado y ubicación en tiempo real (WebSocket)
6. En destino, el transportista pide código de confirmación al dador
7. Dador entrega código → pago se libera → ambos se califican
8. Cualquier lado puede reportar comportamiento inapropiado; admin resuelve

---

## Levantar el proyecto local

### Prerequisitos
- Node.js ≥ 20
- PostgreSQL (o `docker run -p 5432:5432 -e POSTGRES_PASSWORD=... postgres`)
- Expo CLI para mobile: `npm i -g expo`

### 1. API (backend)

```bash
cd api
cp .env.example .env
# Editar .env: DATABASE_URL, JWT_SECRET (obligatorios)
# Integraciones externas son opcionales — la app corre sin ellas en modo mock
npm install
npm run start:dev
# API en http://localhost:3001
```

### 2. Web (frontend)

```bash
cd web
cp .env.example .env.local  # crear si no existe
npm install
npm run dev
# Web en http://localhost:3000
```

### 3. Mobile

```bash
cd mobile
npm install
npm start
# Escanear QR con Expo Go
```

---

## Variables de entorno clave

Ver [`api/.env.example`](api/.env.example) para la lista completa.

| Variable | Uso | Opcional |
|----------|-----|----------|
| `DATABASE_URL` | Postgres connection string | ❌ |
| `JWT_SECRET` | Firma de tokens JWT | ❌ |
| `INTERNAL_SECRET` | Auth entre web y api para endpoints admin | ❌ |
| `MP_ACCESS_TOKEN` | MercadoPago (pagos) | Sí — sin esto falla la etapa de pago |
| `RESEND_API_KEY` | Mails transaccionales (seguros) | Sí — fallback a Nodemailer |
| `GOOGLE_VISION_API_KEY` | OCR automático de DNI | Sí — verificación queda manual |
| `VERIFF_PROVIDER` | `veriff` para real, cualquier otra cosa = mock | Sí — default mock |
| `VERIFF_API_KEY` / `VERIFF_API_SECRET` | Credenciales de Veriff | Solo si `VERIFF_PROVIDER=veriff` |

---

## Testing

**Backend (Jest):**
```bash
cd api
npm test                  # unit tests con mocks (no requiere DB)
npm run test:coverage
```

**Web (Playwright E2E):**
```bash
cd web
npx playwright install --with-deps chromium
# Setear cuentas de test en web/.env.test (ver TEST_SETUP.md)
npx playwright test --project=setup     # generar sesiones autenticadas
npm run test:e2e
```

Guía completa: [`TEST_SETUP.md`](TEST_SETUP.md).

---

## Estructura del repo

```
api/src/
├── auth/          Login, registro, JWT, guards
├── loads/         Publicación de cargas
├── offers/        Ofertas de transportistas
├── payments/      MercadoPago + confirmación con código
├── messages/      Chat WebSocket
├── ratings/       Calificaciones bidireccionales
├── fleet/         Invitaciones, camiones, conductores
├── documents/     Upload de licencia, VTV, seguros
├── verification/  Veriff (interface + mock/real intercambiables)
├── reports/       Reportes de usuarios + acciones de admin
├── admin/         Retiros, suspensión, banneo
├── alerts/        Detección de precios sospechosos
├── insurance/     Contratación de pólizas
├── onboarding/    Gating de features hasta completar perfil
├── stats/         Métricas para dashboards
└── entities/      TypeORM entities (fuente de verdad del modelo)

web/src/app/
├── dador/         Dashboard del dador (publicar carga, ver ofertas, pagos)
├── transportista/ Dashboard individual (buscar cargas, ofertar)
├── flota/         Dashboard de dueño de flota
├── empleado/      Dashboard de empleado
├── admin/         Panel de admin
├── login/         Registro con selección de rol
├── onboarding/    Wizard de perfil obligatorio
├── verificar-identidad/  Flujo Veriff
├── invitacion/    Landing de invitaciones a flota
├── pago/          Callback de MercadoPago
├── para/          Landing pages (camioneros, dadores, flotas)
├── api/           Route handlers (proxy a la API + NextAuth)
└── dev/           Herramientas de desarrollo (mapa de prueba, etc.)

mobile/src/screens/
├── auth/          Login, registro
└── app/           Cargas, viajes, camiones, documentos, perfil
```

---

## Documentación adicional

- [`TEST_SETUP.md`](TEST_SETUP.md) — Guía completa de testing
- [`PLAN_REPORTES.md`](PLAN_REPORTES.md) — Diseño del sistema de reportes
- [`PLAN_REFACTOR_VISTAS.md`](PLAN_REFACTOR_VISTAS.md) — Diseño de 4 tipos de cuenta
- [`PLAN_PRE_ENTREGA.md`](PLAN_PRE_ENTREGA.md) — Checklist pre-entrega

---

## Convención de commits

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de un bug |
| `refactor` | Cambio de código sin modificar comportamiento |
| `docs` | Cambios en documentación |
| `test` | Agregar o modificar tests |
| `chore` | Mantenimiento: dependencias, configuración, etc. |
| `style` | Formato, espacios, comas (sin cambiar lógica) |

Ejemplo: `feat(auth): agregar login con Google`
