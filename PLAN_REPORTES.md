# Plan de Trabajo: Sistema de Reportes de Usuarios

## User Story
> Como usuario, quiero poder reportar a otro usuario por comportamiento inapropiado, para alertar a los administradores de posibles fraudes o abusos.

**Tipo:** Full-stack | **Prioridad:** Media

---

## Decisiones de Diseño (basadas en las respuestas del PO)

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | ¿Dónde aparece el botón "Reportar"? | Mini-vista de perfil público accesible desde el chat, desde las ofertas del camionero, y al calificar al finalizar un viaje (ambos lados) |
| 2 | ¿Múltiples reportes? | Un solo reporte activo por par de usuarios |
| 3 | ¿Motivos? | Selección (Fraude/estafa, Incumplimiento de entrega, Acoso/lenguaje inapropiado, Datos falsos, Otro) + caja de texto libre obligatoria |
| 4 | ¿Acciones del admin? | Resolver, descartar, suspender usuario, banear usuario |
| 5 | ¿Notificaciones? | Email al admin al crear reporte. No se notifica al usuario reportado |
| 6 | ¿Panel admin? | Nueva sección dentro del mismo flujo de admin existente (autenticación por `x-internal-secret`) |
| 7 | ¿Evidencia? | Sí, el usuario puede adjuntar capturas/fotos (reutilizar patrón de upload a disco local existente) |

---

## Criterios de Aceptación

- [ ] Botón "Reportar" accesible desde: mini perfil público, chat de viaje, y modal de calificación post-viaje
- [ ] Formulario con: motivo (selección), descripción (texto libre obligatorio), evidencia (foto opcional)
- [ ] Un solo reporte activo por par `reporter → reported` (constraint de unicidad con `status != 'dismissed' AND status != 'resolved'`)
- [ ] El reporte queda registrado en la DB con toda la información
- [ ] Email automático al admin cuando se crea un reporte
- [ ] El admin ve los reportes pendientes en su panel con toda la info + evidencia
- [ ] El admin puede: resolver, descartar, suspender o banear al usuario reportado
- [ ] El usuario baneado/suspendido no puede operar en la plataforma

---

## Arquitectura de la Solución

### Modelo de datos

```
┌─────────────────────────────────────────────────────┐
│                    reports                           │
├─────────────────────────────────────────────────────┤
│ id              UUID  PK                            │
│ reporter_id     UUID  FK → users.id                 │
│ reported_id     UUID  FK → users.id                 │
│ reason          ENUM  (ver motivos abajo)           │
│ description     TEXT  NOT NULL                      │
│ evidence_url    VARCHAR  NULLABLE                   │
│ status          ENUM  'pending'|'under_review'|     │
│                       'resolved'|'dismissed'        │
│ admin_action    ENUM  NULLABLE  'none'|'warned'|    │
│                       'suspended'|'banned'          │
│ admin_notes     TEXT  NULLABLE                      │
│ created_at      TIMESTAMP                           │
│ resolved_at     TIMESTAMP  NULLABLE                 │
└─────────────────────────────────────────────────────┘

Motivos (reason enum):
  - 'fraud'           → Fraude / estafa
  - 'non_delivery'    → Incumplimiento de entrega
  - 'harassment'      → Acoso / lenguaje inapropiado
  - 'fake_data'       → Datos falsos
  - 'other'           → Otro
```

### Cambio en User entity

```
users (agregar campo):
  - account_status  VARCHAR  DEFAULT 'active'
    Valores: 'active' | 'suspended' | 'banned'
```

> Este campo se valida en `JwtStrategy` o en `AuthService` al hacer login: si `account_status !== 'active'`, se rechaza con mensaje apropiado.

---

## Tareas (ordenadas por dependencia)

### Fase 1: Backend — Modelo y Lógica de Negocio

#### Tarea 1.1: Crear entity `Report`
- **Archivo nuevo:** `api/src/entities/report.entity.ts`
- **Campos:** id, reporter_id, reported_id, reason, description, evidence_url, status, admin_action, admin_notes, created_at, resolved_at
- **Relaciones:** ManyToOne → User (reporter), ManyToOne → User (reported)
- **Sin unique constraint en DB** — la unicidad de "un reporte activo" se valida en el service

#### Tarea 1.2: Agregar `account_status` al User entity
- **Archivo:** `api/src/entities/user.entity.ts`
- **Agregar:** `account_status: 'active' | 'suspended' | 'banned'` con default `'active'`
- **Modificar:** `api/src/auth/auth.service.ts` — en `login()`, después de validar credenciales, verificar que `account_status === 'active'`. Si es `suspended`, devolver `ForbiddenException('Tu cuenta está suspendida. Contactá a soporte.')`. Si es `banned`, devolver `ForbiddenException('Tu cuenta fue deshabilitada.')`

#### Tarea 1.3: Crear módulo Reports (service + controller)
- **Archivos nuevos:**
  - `api/src/reports/reports.module.ts`
  - `api/src/reports/reports.service.ts`
  - `api/src/reports/reports.controller.ts`

- **Endpoints del controller:**

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/reports` | JwtAuthGuard | Usuario crea un reporte |
| `GET` | `/reports/admin` | x-internal-secret | Admin lista todos los reportes |
| `PATCH` | `/reports/admin/:id` | x-internal-secret | Admin actualiza estado/acción |

- **Service — `createReport(userId, body)`:**
  1. Validar que `reported_id` existe y no es el mismo usuario
  2. Validar que no existe un reporte activo (`status IN ('pending', 'under_review')`) del mismo reporter al mismo reported
  3. Crear el reporte con status `'pending'`
  4. Enviar email al admin (usar `MailService` existente)
  5. Retornar el reporte creado

- **Service — `getAdminReports()`:**
  1. Traer todos los reportes ordenados por `created_at DESC`
  2. Incluir relaciones con users (reporter y reported): name, email, role
  3. Retornar array

- **Service — `updateReport(reportId, body)`:**
  1. Actualizar status y admin_notes
  2. Si `admin_action === 'suspended'` o `'banned'`, actualizar `reported_user.account_status`
  3. Si status cambia a `'resolved'` o `'dismissed'`, setear `resolved_at = new Date()`
  4. Retornar el reporte actualizado

#### Tarea 1.4: Endpoint de upload de evidencia
- **Archivo:** `api/src/reports/reports.controller.ts`
- **Endpoint:** `POST /reports/upload-evidence` (JwtAuthGuard + FileInterceptor)
- **Patrón:** Idéntico al de `documents.controller.ts` — disk storage en `uploads/reports/`, retorna URL
- **Límite:** 10 MB, solo imágenes (jpg, png, webp)

#### Tarea 1.5: Registrar ReportsModule en AppModule
- **Archivo:** `api/src/app.module.ts`
- **Agregar:** `ReportsModule` al array de imports

#### Tarea 1.6: Agregar método `sendNuevoReporte` al MailService
- **Archivo:** `api/src/mail/mail.service.ts`
- **Método nuevo:** `sendNuevoReporte({ reporterName, reportedName, reason, description })`
- **Destino:** Email del admin (variable de entorno `ADMIN_EMAIL` o hardcoded)
- **Template:** Reutilizar `buildHtml()` existente con filas de info del reporte

---

### Fase 2: Frontend — Rutas API Proxy (Next.js)

#### Tarea 2.1: Ruta para crear reporte
- **Archivo nuevo:** `web/src/app/api/reports/route.ts`
- **POST:** Proxy a backend `POST /reports` con backendToken de sesión

#### Tarea 2.2: Ruta para upload de evidencia
- **Archivo nuevo:** `web/src/app/api/reports/upload-evidence/route.ts`
- **POST:** Proxy multipart a backend `POST /reports/upload-evidence`

#### Tarea 2.3: Rutas admin de reportes
- **Archivo nuevo:** `web/src/app/api/admin/reports/route.ts`
- **GET:** Proxy a backend `GET /reports/admin` con header x-internal-secret
- **Archivo nuevo:** `web/src/app/api/admin/reports/[id]/route.ts`
- **PATCH:** Proxy a backend `PATCH /reports/admin/:id` con header x-internal-secret

---

### Fase 3: Frontend — Mini Perfil Público + Modal de Reporte

#### Tarea 3.1: Componente `ModalPerfilPublico`
- **Archivo:** `web/src/app/_components/ModalPerfilPublico.tsx` (nuevo, componente reutilizable)
- **Props:** `{ userId, userName, userRole, rating, viajesCount, memberSince, onClose, onReportar }`
- **Contenido:**
  - Avatar con iniciales
  - Nombre, rol (Transportista / Dador de carga)
  - Calificación promedio + cantidad de viajes
  - Miembro desde (fecha)
  - Botón "Reportar usuario" (rojo, dispara `onReportar`)

#### Tarea 3.2: Componente `ModalReportar`
- **Archivo:** `web/src/app/_components/ModalReportar.tsx` (nuevo, componente reutilizable)
- **Props:** `{ reportedUserId, reportedUserName, onClose, onSuccess }`
- **Contenido del formulario:**
  - Select de motivo: Fraude/estafa, Incumplimiento, Acoso, Datos falsos, Otro
  - Textarea de descripción (obligatorio, min 20 caracteres)
  - Upload de evidencia (opcional, preview de imagen)
  - Botón "Enviar reporte"
- **Flujo:**
  1. Si hay evidencia, primero `POST /api/reports/upload-evidence` → obtener URL
  2. Luego `POST /api/reports` con `{ reportedId, reason, description, evidenceUrl }`
  3. Mostrar confirmación de éxito o error

#### Tarea 3.3: Integrar en el lado Transportista
- **Archivo:** `web/src/app/transportista/page.tsx`
- **Puntos de integración:**

| Ubicación | Cambio |
|-----------|--------|
| `VistaTripDetalle` (chat) | Agregar botón "Ver perfil" junto al nombre del dador → abre `ModalPerfilPublico` |
| `ModalCalificarDador` | Agregar link "Reportar comportamiento" debajo de las estrellas → abre `ModalReportar` |
| `SeccionMisOfertas` (cards) | Agregar link sutil "Ver perfil del dador" en cards de ofertas aceptadas |

#### Tarea 3.4: Integrar en el lado Dador
- **Archivo:** `web/src/app/dador/page.tsx`
- **Puntos de integración:**

| Ubicación | Cambio |
|-----------|--------|
| Chat con el camionero | Agregar botón "Ver perfil" junto al nombre del driver → abre `ModalPerfilPublico` |
| `ModalCalificarCamionero` | Agregar link "Reportar comportamiento" debajo de las estrellas → abre `ModalReportar` |
| Cards de ofertas recibidas | Agregar link "Ver perfil" junto al nombre del camionero |

#### Tarea 3.5: API para obtener datos de perfil público
- **Backend:** Agregar endpoint `GET /users/:id/public-profile` en un nuevo controller o en auth
  - Retorna: name, role, created_at, avg_rating, rating_count, viajes_completados
  - Auth: JwtAuthGuard (cualquier usuario autenticado puede ver)
- **Frontend route:** `web/src/app/api/users/[id]/public-profile/route.ts`

---

### Fase 4: Frontend — Panel Admin de Reportes

#### Tarea 4.1: Sección de reportes en el panel admin
- **Archivo:** `web/src/app/admin/page.tsx` (extender el existente)
- **Agregar:**
  - Tabs en el panel: "Retiros" (actual) | "Reportes" (nuevo)
  - Cuando tab = "Reportes":
    - Fetch `GET /api/admin/reports` con header x-internal-secret
    - Lista de reportes con filtros por status (Pendientes / En revisión / Resueltos / Descartados)

#### Tarea 4.2: Card de reporte en el admin
- **Cada card muestra:**
  - Info del reportante: nombre, email, rol
  - Info del reportado: nombre, email, rol
  - Motivo (badge con color según tipo)
  - Descripción completa
  - Evidencia (thumbnail clickeable si hay imagen)
  - Fecha de creación
  - Status actual
- **Acciones del admin:**
  - Textarea para notas del admin
  - Botones:
    - "Marcar en revisión" (si está pending)
    - "Resolver" (cierra el reporte sin acción grave)
    - "Descartar" (reporte inválido)
    - "Suspender usuario" (cambia account_status a suspended + resuelve)
    - "Banear usuario" (cambia account_status a banned + resuelve)
  - Cada acción hace `PATCH /api/admin/reports/:id` con `{ status, admin_action, admin_notes }`

---

### Fase 5: Validación de cuenta suspendida/baneada

#### Tarea 5.1: Bloquear login de usuarios suspendidos/baneados
- **Archivo:** `api/src/auth/auth.service.ts`
- **En el método `login()`:** después de validar credenciales, verificar `user.account_status`:
  - `'suspended'` → throw `ForbiddenException('Tu cuenta está suspendida temporalmente. Contactá a soporte para más información.')`
  - `'banned'` → throw `ForbiddenException('Tu cuenta fue deshabilitada permanentemente.')`

#### Tarea 5.2: Validar en JwtStrategy (defensa en profundidad)
- **Archivo:** `api/src/auth/jwt.strategy.ts`
- **En `validate()`:** verificar `account_status` del usuario en DB. Si no es `'active'`, throw `UnauthorizedException()`
- **Esto cubre:** tokens JWT que fueron emitidos antes de la suspensión/baneo

---

## Resumen de archivos

### Archivos nuevos (11)
| Archivo | Tipo |
|---------|------|
| `api/src/entities/report.entity.ts` | Entity |
| `api/src/reports/reports.module.ts` | Module |
| `api/src/reports/reports.service.ts` | Service |
| `api/src/reports/reports.controller.ts` | Controller |
| `web/src/app/api/reports/route.ts` | API Route |
| `web/src/app/api/reports/upload-evidence/route.ts` | API Route |
| `web/src/app/api/admin/reports/route.ts` | API Route |
| `web/src/app/api/admin/reports/[id]/route.ts` | API Route |
| `web/src/app/api/users/[id]/public-profile/route.ts` | API Route |
| `web/src/app/_components/ModalPerfilPublico.tsx` | Component |
| `web/src/app/_components/ModalReportar.tsx` | Component |

### Archivos modificados (8)
| Archivo | Cambio |
|---------|--------|
| `api/src/entities/user.entity.ts` | Agregar campo `account_status` |
| `api/src/app.module.ts` | Registrar `ReportsModule` |
| `api/src/auth/auth.service.ts` | Validar `account_status` en login |
| `api/src/auth/jwt.strategy.ts` | Validar `account_status` en JWT validate |
| `api/src/mail/mail.service.ts` | Agregar método `sendNuevoReporte` |
| `web/src/app/transportista/page.tsx` | Integrar modales de perfil y reporte |
| `web/src/app/dador/page.tsx` | Integrar modales de perfil y reporte |
| `web/src/app/admin/page.tsx` | Agregar sección de reportes |

---

## Orden de implementación recomendado

```
Fase 1 (Backend)          ████████████████░░░░░░░░░░░░░░░░
Fase 2 (API Routes)       ░░░░░░░░░░░░░░░░████░░░░░░░░░░░░
Fase 3 (Frontend usuario) ░░░░░░░░░░░░░░░░░░░░████████░░░░
Fase 4 (Frontend admin)   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████
Fase 5 (Validación auth)  ░░░░░░████░░░░░░░░░░░░░░░░░░░░░░
                           1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6
                                  ↓
                                 5.1 → 5.2
                                        ↓
                                  2.1 → 2.2 → 2.3
                                               ↓
                                    3.5 → 3.1 → 3.2 → 3.3 → 3.4
                                                              ↓
                                                       4.1 → 4.2
```

**Dependencias críticas:**
- Tarea 1.1 (Entity) bloquea todo lo demás
- Tarea 1.2 (account_status en User) bloquea Fase 5
- Tarea 1.3 (Service) bloquea Fase 2 y 3
- Tarea 3.5 (API perfil público) bloquea 3.1 (ModalPerfilPublico)
