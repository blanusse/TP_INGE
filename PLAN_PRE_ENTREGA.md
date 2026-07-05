# Plan: Pasos pre-entrega académica — CargaBack

## Contexto

El proyecto CargaBack (plataforma logística AR, stack Next.js + NestJS + React Native + PostgreSQL) ya tiene el desarrollo terminado, los tests pasando y la app deployada. Se necesita preparar la entrega final académica.

---

## Pasos en orden de prioridad

### 1. Verificación end-to-end del sistema deployado

Antes de cualquier otra cosa, validar que el entorno de producción funciona correctamente.

**Acciones:**
- Recorrer el flujo completo por cada rol: `transportista`, `flota`, `empleado`, `dador de carga`, `admin`
- Verificar que los flujos críticos funcionen: publicar carga → recibir oferta → aceptar → pago MercadoPago → calificación
- Probar WebSockets (chat, notificaciones en tiempo real)
- Verificar subida/descarga de imágenes y documentos
- Confirmar que el mapa y la geolocalización funcionan en mobile

**Archivos relevantes:**
- `web/tests/e2e/` — correr los tests Playwright contra la URL de producción (`PLAYWRIGHT_BASE_URL`)
- `api/src/health` — verificar endpoint `/health` responde OK

---

### 2. Limpieza de código

Eliminar rastros de desarrollo que no deberían estar en la entrega.

**Acciones:**
- Eliminar `console.log` de debug que no sean intencionales
- Eliminar código comentado y TODOs que quedaron sin resolver (o documentarlos si son conocidos)
- Verificar que no haya credenciales hardcodeadas en el código (tokens, passwords, API keys)
- Revisar que `.env.example` en `api/` esté actualizado con todas las variables necesarias

**Comandos útiles:**
```bash
# Buscar console.log en el backend
grep -r "console.log" api/src --include="*.ts" -l

# Buscar TODOs pendientes
grep -r "TODO\|FIXME\|HACK" api/src web/src --include="*.ts" --include="*.tsx"

# Verificar que no hay secrets hardcodeados
grep -r "password\|secret\|token" api/src --include="*.ts" -i -l
```

---

### 3. Documentación mínima requerida

Para una entrega académica necesitan un README útil, no el default de NestJS/Next.js.

**Actualizar `README.md` raíz con:**
- Descripción del proyecto (qué es CargaBack, problema que resuelve)
- Diagrama de arquitectura (puede ser texto/ASCII o imagen)
- Roles del sistema y qué puede hacer cada uno
- Cómo levantar el proyecto localmente (paso a paso: prerequisitos, env vars, `npm install`, `npm run start:dev`)
- URL de la app deployada (web + API)
- Cómo correr los tests (`npm run test`, `npm run test:e2e`)
- Integraciones externas: MercadoPago, Google Cloud Vision, Resend/Nodemailer, Supabase

**Archivos a actualizar:**
- `/README.md` (actualmente solo tiene convenciones de commits)
- `api/README.md` (actualmente es el template de NestJS)
- `web/README.md` (actualmente es el template de Next.js)

---

### 4. Preparar datos de demo

Para la presentación necesitan datos realistas que cuenten una historia.

**Acciones:**
- Crear usuarios de demo para cada rol con credenciales fáciles de recordar (ej: `demo-transportista@cargaback.com` / `Demo1234!`)
- Cargar al menos 1-2 viajes en diferentes estados del ciclo de vida (publicada, con oferta, en curso, completada)
- Tener un pago de MercadoPago completado para mostrar
- Tener calificaciones cargadas
- Preparar un script o checklist de los pasos de la demo para no improvisar en vivo

---

### 5. Preparar la presentación técnica

Los profesores suelen evaluar las decisiones de diseño, no solo que "funcione".

**Contenido sugerido para la presentación:**
1. **Problema y solución** — qué problema logístico resuelve CargaBack
2. **Arquitectura** — diagrama de 3 capas (web, api, mobile) con la base de datos y servicios externos
3. **Modelo de datos** — entidades principales y relaciones (TypeORM entities)
4. **Decisiones técnicas** — por qué NestJS, por qué Next.js, WebSockets para el chat, MercadoPago para pagos
5. **Flujo de la demo** — seguir un caso de uso real de punta a punta
6. **Testing** — mostrar que los tests corren y pasan
7. **Dificultades encontradas** — siempre preguntan esto

**Archivos útiles para referencia:**
- `api/src/` — estructura de módulos NestJS (entidades, servicios, controllers)
- `PLAN_REPORTES.md` y `PLAN_REFACTOR_VISTAS.md` — decisiones de diseño documentadas
- `api/.env.example` — lista de integraciones externas

---

### 6. Revisión final pre-presentación (día antes)

- Confirmar que la URL deployada está activa y accesible
- Probar el flujo de demo completo una vez más
- Tener un plan B si la conexión falla (capturas de pantalla o video del flujo)
- Revisar que todos los integrantes del equipo puedan explicar cualquier parte del código

---

## Orden de ejecución recomendado

| Prioridad | Tarea | Tiempo estimado |
|-----------|-------|----------------|
| 1 | Verificación end-to-end en producción | 2-3 horas |
| 2 | Limpieza de código (logs, TODOs, credenciales) | 1-2 horas |
| 3 | Actualizar README raíz con descripción + setup | 2-3 horas |
| 4 | Preparar datos de demo + usuarios | 1 hora |
| 5 | Armar presentación técnica | 3-4 horas |
| 6 | Ensayo de la demo | 1 hora |

---

## Verificación final

- [ ] Todos los roles funcionan en producción sin errores
- [ ] Tests pasan (`npm run test` en `api/`)
- [ ] E2E tests pasan contra la URL de producción
- [ ] README describe cómo levantar el proyecto desde cero
- [ ] No hay credenciales hardcodeadas en el código
- [ ] Datos de demo cargados en el entorno deployado
- [ ] Presentación lista con arquitectura y flujo de demo
- [ ] Ensayo hecho al menos una vez
