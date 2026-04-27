# Plan de Refactor: 4 Tipos de Cuenta

## Estado actual
- El registro tiene 2 perfiles: `transportista` | `dador`
- El tipo de dador se subdivide: `personal` | `empresa`
- Un transportista se "convierte" en fleet owner dinámicamente al invitar conductores
- Un transportista se "convierte" en empleado al aceptar una invitación
- No hay forma de elegir tipo de cuenta al registrarse

## Objetivo
4 tipos de cuenta desde el registro:
1. **Transportista individual** — camionero solo
2. **Dueño de flota** — empresa de transporte
3. **Empleado de empresa** — conductor que trabaja para una flota
4. **Dador de carga** — quien publica cargas (ya existe, no cambia)

---

## Fase 1: Backend — Modelo de datos y registro

### 1.1 Modificar RegisterDto
**Archivo:** `api/src/auth/dto/register.dto.ts`
- Cambiar `role` de `'transportista' | 'dador'` a `'transportista' | 'flota' | 'empleado' | 'dador'`
- Agregar campo opcional `invitation_token?: string` (para empleados que se registran con invitación)

### 1.2 Modificar AuthService.register()
**Archivo:** `api/src/auth/auth.service.ts`
- Si `role === 'flota'`:
  - Guardar user con `role: 'transportista'`, `is_fleet_owner: true`
- Si `role === 'empleado'`:
  - Validar que venga `invitation_token`
  - Buscar la invitación, validar que no esté vencida/usada
  - Guardar user con `role: 'transportista'`, `fleet_id: invitación.fleet_owner_id`
  - Marcar invitación como aceptada
  - Marcar al owner como `is_fleet_owner = true`
- Si `role === 'transportista'`:
  - Guardar como hoy (individual, sin fleet_id, sin is_fleet_owner)
- Si `role === 'dador'`:
  - Sin cambios

### 1.3 Login response (ya hecho)
`fleet_id` e `is_fleet_owner` ya se retornan en el login. No hay cambios.

---

## Fase 2: Frontend — Flujo de registro

### 2.1 Modificar la selección de perfil en login/page.tsx
**Archivo:** `web/src/app/login/page.tsx`
- Cambiar `type Perfil = "transportista" | "dador"` a `"transportista" | "flota" | "empleado" | "dador"`
- Cambiar `type Paso` para agregar paso de selección de sub-tipo transportista
- En el paso "perfil" (elegir rol), mostrar 4 tarjetas:
  1. Transportista individual
  2. Dueño de flota
  3. Empleado de empresa
  4. Dador de carga
- Si elige "empleado", pedir código/token de invitación antes del formulario de registro
- Si elige "flota", registro similar a transportista pero se marca is_fleet_owner
- Si elige "dador", flujo existente (sub-tipo personal/empresa)

### 2.2 Modificar el formulario de registro
**Archivo:** `web/src/app/login/page.tsx`
- Enviar el nuevo `role` al backend (`transportista` | `flota` | `empleado` | `dador`)
- Para empleado: incluir `invitation_token` en el body
- Para flota: incluir campo opcional de nombre de empresa/razón social

### 2.3 Actualizar landing page
**Archivo:** `web/src/app/page.tsx`
- Actualizar los CTAs/links si es necesario
- Las páginas `/para/camioneros` y `/para/dadores` ya existen. Evaluar si agregar `/para/flotas`

---

## Fase 3: Frontend — Vistas por tipo (ya parcialmente hecho)

### 3.1 Rutas existentes (de la branch feat/refactor-vistas)
- `/transportista` — individual (nav: Inicio, Buscar cargas, Planificar viaje, Mis ofertas, Mis viajes, Notificaciones)
- `/flota` — dueño de flota (nav: Mi flota, Buscar cargas, Mis viajes, Notificaciones, Mi perfil)
- `/empleado` — empleado (nav: Mis viajes, Mi perfil, Notificaciones)
- `/dador` — dador (sin cambios)

### 3.2 Agregar "Mi flota" a la vista individual
**Archivo:** `web/src/app/transportista/page.tsx`
- Agregar "Mi flota" al nav de individual para que pueda invitar gente
- Cuando invita a su primer conductor, su cuenta se actualiza a fleet owner
- Al re-loguearse, el middleware lo manda a `/flota`

### 3.3 Actualizar link post-invitación
**Archivo:** `web/src/app/invitacion/[token]/page.tsx`
- Cambiar `router.push("/transportista")` a `router.push("/empleado")`
- Agregar opción: si el usuario no tiene cuenta, redirigir a registro con el token pre-cargado

### 3.4 Middleware y auth (ya hecho)
- Middleware ya rutea por `fleetId` / `isFleetOwner`
- Auth config ya pasa esos valores en la sesión

---

## Fase 4: Ajustes de UX por vista

### 4.1 Vista empleado (`/empleado`)
- Mostrar banner: "Sos parte de la flota de [nombre del owner]"
- Mostrar viajes asignados
- Perfil con documentación propia
- Sin acceso a buscar cargas ni ofertar (eso lo hace el dueño)

### 4.2 Vista flota (`/flota`)
- Mi flota: gestionar camiones y conductores, invitar por mail
- Buscar cargas: buscar y ofertar asignando un conductor
- Mis viajes: ver viajes de toda la flota
- Ver documentación de conductores

### 4.3 Vista individual (`/transportista`)
- Todo como está, con posibilidad de invitar gente (Mi flota en el nav)

---

## Orden de ejecución

| # | Tarea | Archivos principales |
|---|-------|---------------------|
| 1 | Modificar RegisterDto | `api/src/auth/dto/register.dto.ts` |
| 2 | Modificar AuthService.register() para 4 tipos | `api/src/auth/auth.service.ts` |
| 3 | Actualizar selección de perfil (4 tarjetas) | `web/src/app/login/page.tsx` |
| 4 | Actualizar formulario registro (enviar role + token) | `web/src/app/login/page.tsx` |
| 5 | Fix link post-invitación | `web/src/app/invitacion/[token]/page.tsx` |
| 6 | Agregar "Mi flota" al nav individual | `web/src/app/transportista/page.tsx` |
| 7 | Banner de flota en vista empleado | `web/src/app/transportista/page.tsx` (componente compartido) |
| 8 | Testear flujo completo de registro x cada tipo |  |

## Notas
- El role en la DB sigue siendo `transportista` para los 3 tipos de camionero. La diferenciación es por `is_fleet_owner` y `fleet_id`.
- El dador no cambia nada.
- El empleado SOLO puede registrarse si tiene un token de invitación válido.
