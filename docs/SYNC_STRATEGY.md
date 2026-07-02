# SYNC STRATEGY

## Objetivo

Garantizar que la aplicacion funcione sin conexion a internet y sincronice automaticamente en ambas direcciones:
- **Mobile -> Web**: cambios hechos en el celular se suben al backend
- **Web -> Mobile**: productos, categorias, clientes, empleados creados desde el dashboard web llegan al celular

---

## Principios

* Offline-first. La operacion nunca depende de internet.
* PostgreSQL es la fuente de verdad global.
* SQLite es la fuente de verdad local en el celular.
* UUID para todas las entidades (generados localmente, sin conflictos).
* Sincronizacion automatica, no bloqueante.

---

## Arquitectura bidireccional

```
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   CELULAR/APP    │  PUSH    │    BACKEND        │  REST    │   DASHBOARD WEB  │
│   (SQLite)       │ ────────>│   (PostgreSQL)    │<─────────│   (Next.js)      │
│                  │          │                   │          │                  │
│ sync_operations  │  PULL    │ syncOperation     │          │ POST /products   │
│ device_state     │<─────────│ updatedAt filter  │          │ PUT /products/:id│
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

### Flujo Mobile -> Web (PUSH)
1. Celular crea/modifica/elimina entidad en SQLite
2. Se encola en `sync_operations` con status `pending`
3. En el proximo sync cycle (60s o manual), se envia POST `/api/v1/sync/push`
4. Backend procesa con upsert/soft-delete en PostgreSQL
5. Celular marca operacion como `synced`

### Flujo Web -> Mobile (PULL)  
1. Dashboard web crea/modifica entidad via REST (`/api/v1/dashboard/products`)
2. Prisma actualiza automaticamente `updatedAt` en PostgreSQL
3. En el proximo sync cycle del celular (60s o al abrir app), GET `/api/v1/sync/pull?last_sync_at=...`
4. Backend devuelve todos los registros con `updatedAt > lastSyncAt`
5. Celular aplica cambios en SQLite con UPSERT

### Triggers de sincronizacion

| Trigger | Timing |
|---------|--------|
| App launch | Inmediato (siempre pull + push pendientes) |
| Periodic auto-sync | Cada 60 segundos |
| Manual (boton Sync) | On demand |
| Reconnect after offline | Inmediato |

---

## Entidades sincronizadas (7 tipos)

| Entity Type | SQLite Table | Sync Direction | Operaciones |
|-------------|-------------|----------------|-------------|
| `category` | `categories` | WEB -> MOBILE (pull) | insert, update, delete |
| `product` | `products` | BIDIRECCIONAL | insert, update, soft-delete |
| `customer` | `customers` | WEB -> MOBILE (pull) | insert, update, delete |
| `cash_register` | `cash_registers` | MOBILE -> WEB (push) | insert, update, delete |
| `sale` (+ items) | `sales` + `sale_items` | MOBILE -> WEB (push) | insert, update, delete |
| `inventory_movement` | `inventory_movements` | MOBILE -> WEB (push) | insert, update, delete |
| `user` | `users` | BIDIRECCIONAL | insert, update, soft-delete |

> **Nota:** `category` y `customer` se gestionan desde el dashboard web. El celular los recibe via pull pero no los modifica (en MVP). `sale`, `cash_register`, `inventory_movement` se crean en el celular y se suben via push. `product` y `user` son bidireccionales.

---

## Tablas SQLite (mobile)

| Tabla | Proposito |
|-------|-----------|
| `users` | Empleados con PIN (sync desde backend) |
| `products` | Catalogo de productos |
| `categories` | Categorias de productos (sync desde backend) |
| `customers` | Clientes (sync desde backend) |
| `cash_registers` | Sesiones de caja |
| `sales` | Cabecera de ventas |
| `sale_items` | Detalle de items vendidos |
| `inventory_movements` | Movimientos de stock |
| `sync_operations` | Cola de operaciones pendientes de push |
| `device_state` | ID del dispositivo, last_sync_at |
| `app_meta` | Configuracion clave-valor |

---

## Endpoints

### PUSH: `POST /api/v1/sync/push`

```json
{
  "operations": [{
    "operation_id": "uuid",
    "entity_type": "product",
    "entity_id": "uuid",
    "operation": "create",
    "payload": { "name": "Producto", ... }
  }]
}
```

Backend procesa cada operacion con upsert. Self-healing: auto-crea entidades referenciadas si no existen (ej: categoria de un producto).

### PULL: `GET /api/v1/sync/pull?last_sync_at=2026-07-01T00:00:00Z`

```json
{
  "success": true,
  "changes": [
    { "entity_type": "product", "entity_id": "uuid", "operation": "update", "payload": {...} },
    { "entity_type": "category", "entity_id": "uuid", "operation": "update", "payload": {...} },
    { "entity_type": "sale", "entity_id": "uuid", "operation": "update", "payload": {...} }
  ],
  "server_time": "2026-07-01T21:00:00Z"
}
```

---

## Manejo de conflictos

Regla MVP: **Ultima actualizacion gana** (last-write-wins).

- Push: PostgreSQL upsert sobreescribe cualquier valor existente
- Pull: SQLite `INSERT ON CONFLICT DO UPDATE` sobreescribe el valor local
- No hay merge de campos, no hay notificacion al usuario
- Las ventas son inmutables (solo create/delete, nunca update)

---

## Reintentos

Operaciones fallidas se reintentan hasta 10 veces:
- Cada sync cycle (60s) vuelve a intentar las `pending`
- Despues de 10 fallos, se marca como `failed` (dead letter)
- Las operaciones `failed` requieren intervencion manual

---

## Como verificar que funciona

1. Crear un producto en el dashboard web
2. En el celular, esperar 60s o tocar "Sync"
3. Verificar que el producto aparece en la lista de productos del celular

Para debuggear:
```bash
# Ver ultima sync en el celular (SQLite)
SELECT * FROM device_state WHERE id = 1;

# Ver operaciones pendientes
SELECT * FROM sync_operations ORDER BY created_at DESC LIMIT 10;

# Ver cambios que llegarian al celular (desde la PC)
curl "http://localhost:3001/api/v1/sync/pull" \
  -H "Authorization: Bearer test-token" \
  -H "X-Device-Id: debug-device"
```

---

## Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/src/sync/sync.service.ts` | Procesa push (upsert) y genera pull (filter by updatedAt) |
| `backend/src/sync/sync.controller.ts` | Endpoints POST /push y GET /pull |
| `apps/mobile/src/sync/syncRunner.ts` | Motor de sync en el celular (push + pull) |
| `apps/mobile/src/context/SyncContext.tsx` | Estado de sync, triggers, polling |
| `apps/mobile/src/api/client.ts` | Tipos PullChange, funciones pushSyncOperations, pullSyncChanges |
| `apps/mobile/src/database/migrations.ts` | Esquema SQLite con todas las tablas |
| `apps/mobile/src/database/types.ts` | Interfaces TypeScript para cada tabla |

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-07-01 | Pull handler extendido a los 7 entity types (antes solo product y user) |
| 2026-07-01 | Agregadas tablas `categories` y `customers` en SQLite |
| 2026-07-01 | Auto-sync al arranque siempre activado (pull de cambios web) |
| 2026-07-01 | Polling periodico cada 60s (antes 30s solo si habia pendientes) |

---

## Token y Tenant: El Flujo Completo (DOCUMENTADO 2026-07-01)

Este es el punto mas critico y la fuente del 90% de los bugs de sincronizacion. Si algo se rompe, leer esta seccion PRIMERO.

### Por que se SKIPEA supabase.auth.setSession()

El SDK de Supabase llama `fetch()` a `supabase.co` cuando se ejecuta `setSession()`. En algunos entornos de red movil, el `fetch()` del runtime de React Native falla aunque el navegador del sistema si pueda cargar `supabase.co`.

**Decision:** NUNCA llamar `supabase.auth.setSession()` desde el celular.

```typescript
// apps/mobile/src/context/AuthContext.tsx - loginWithGoogle()
// El token de Google OAuth se extrae del callback URL
const accessToken = getParam(result.url, 'access_token');

// SE SKIPPEA: await supabase.auth.setSession({ access_token, refresh_token });

// En su lugar, se cachea en memoria y se usa directo contra el backend
setCachedToken(accessToken);
```

### Como se autentican las requests sin setSession()

El token se guarda en una variable en memoria (`cachedToken` en `client.ts`). Todas las requests al backend (sync push, sync pull, health check) lo usan via `getAuthToken()`:

```typescript
// apps/mobile/src/api/client.ts
let cachedToken: string | null = null;

export function setCachedToken(token: string | null) {
  cachedToken = token;
}

async function getAuthToken(): Promise<string> {
  // 1. Si hay token cacheado -> usarlo (token real del usuario)
  if (cachedToken) return cachedToken;

  // 2. Intentar leer sesion de SecureStore (solo funciona si setSession() fue llamado)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.access_token;

  // 3. Fallback: test-token (usuario demo, tenant distinto!)
  //    SOLO para desarrollo. Causa sync en tenant INCORRECTO.
  return 'test-token';
}
```

### Por que se resetea lastSyncAt en cada login

```typescript
// apps/mobile/src/context/AuthContext.tsx - loginWithGoogle()
// Resetear lastSyncAt para que el proximo pull descargue TODO
await db.runAsync(
  `UPDATE device_state SET last_sync_at = NULL WHERE id = 1`
);
```

**Motivo:** El sync se ejecuta al montar la app (antes del login) con `test-token` y un tenant incorrecto. Ese sync SETEA `last_sync_at` a la fecha actual. Cuando el usuario se loguea y el sync usa el token real (tenant correcto), el backend filtra por `updatedAt > lastSyncAt`. Como los productos se crearon ANTES de ese timestamp, el pull devuelve 0 cambios.

Resetear `lastSyncAt` a NULL fuerza que el proximo pull descargue TODOS los registros del tenant correcto.

### Flujo completo paso a paso

```
1. App abre (sin sesion)
   └─ SyncContext: triggerSync()
      └─ getAuthToken() -> 'test-token' (sin cachedToken)
      └─ Push: 0 ops pendientes
      └─ Pull: GET /sync/pull (tenant demo)
         └─ Guard: test-token -> usuario demo hardcodeado
         └─ lastSyncAt = NULL? SI -> descarga TODO del tenant demo
         └─ SETEA device_state.last_sync_at = server_time

2. Usuario hace Login con Google
   └─ AuthContext: loginWithGoogle()
      └─ WebBrowser.openAuthSessionAsync(oauthUrl)
      └─ Extrae accessToken del callback
      └─ setCachedToken(accessToken)           // <-- guarda token real
      └─ Resetea lastSyncAt = NULL              // <-- limpia timestamp viejo
      └─ syncWithBackend(db, accessToken)
         └─ POST /auth/register-or-link (token real)
         └─ Backend: guard valida JWT via JWKS de Supabase
         └─ Guard: busca usuario en DB
            └─ Si existe: devuelve user + tenant
            └─ Si no: lo crea con tenant nuevo
      └─ runSync(db)                            // <-- sync INMEDIATO
         └─ getAuthToken() -> accessToken real  // cachedToken
         └─ Push: 0 opciones pendientes
         └─ Pull: GET /sync/pull (tenant correcto)
            └─ Guard: JWT real -> busca usuario en DB -> tenantId correcto
            └─ lastSyncAt = NULL -> descarga TODO
            └─ Products, categories, customers, etc.
            └─ SETEA device_state.last_sync_at = server_time

3. Usuario crea producto en la web
   └─ Dashboard: POST /dashboard/products
   └─ Prisma: INSERT con updatedAt = now()

4. Sync periodico (60s) o manual
   └─ triggerSync() -> runSync()
      └─ getAuthToken() -> accessToken real (sigue cacheado)
      └─ Pull: GET /sync/pull?last_sync_at=<timestamp>
      └─ Backend: WHERE updatedAt > <timestamp> -> encuentra el nuevo producto
      └─ Mobile: INSERT INTO products ... ON CONFLICT DO UPDATE
```

---

## Guia de Troubleshooting

### "Los productos no aparecen en el celular"

**Checklist (en orden):**

1. **El backend esta corriendo?**
   - `curl http://localhost:3001/api/v1/health` debe responder 200

2. **El backend tiene conexion a Supabase?**
   - Si ves `Can't reach database server` en los logs, revisa DATABASE_URL en `backend/.env`
   - Pooler caido? Cambia a conexion directa (`db.dukyedgoyshhtjkuphow.supabase.co`)

3. **El token esta cacheado?**
   - Hace logout y login de nuevo (fuerza `setCachedToken`)
   - Verifica en los logs de Metro: `[AUTH] accessToken: SI`

4. **El lastSyncAt esta reseteado?**
   - Hace logout y login de nuevo (fuerza reset)
   - O manual: `UPDATE device_state SET last_sync_at = NULL WHERE id = 1`

5. **Los productos existen en PostgreSQL?**
   ```bash
   curl "http://localhost:3001/api/v1/sync/pull" \
     -H "Authorization: Bearer test-token" \
     -H "X-Device-Id: debug"
   ```
   - Cuenta los cambios. Si `products > 0`, el backend esta OK.

6. **El celular alcanza el backend?**
   - Abri `http://192.168.0.10:3001/api/v1/health` en el navegador del celu
   - Si no carga: Firewall de Windows bloqueando puerto 3001

7. **El tenant es correcto?**
   - El `test-token` mapea a un usuario demo con un tenant DISTINTO al real
   - Solo usar `test-token` para debug, nunca para sync de datos reales
   - El token real (de Google OAuth) mapea al tenant correcto

### "Error: Network request failed" en el login Google

- `supabase.auth.setSession()` hace fetch a supabase.co y falla en el celu
- **NO usar setSession()** — ya esta arreglado en el codigo actual
- Si vuelve: revisa `AuthContext.tsx -> loginWithGoogle()` que no llame a `setSession`

### "AbortError: Aborted" en el health check

- El backend no responde en 5 segundos (timeout)
- Backend caido, o firewall bloqueando, o IP incorrecta en `.env`
- Revisa `EXPO_PUBLIC_API_URL` en `apps/mobile/.env`

### "Unique constraint failed on barcode"

- Barcode duplicado (incluso de productos eliminados)
- El backend ahora chequea TODOS los productos (activos e inactivos)
- Mensaje incluye el ID del producto conflictivo

### "Error creating UUID, invalid character"

- El frontend mando un nombre de categoria ("Bebidas") como categoryId
- El backend ahora tiene `resolveCategoryId()` que busca o crea la categoria por nombre

---

## Archivos Clave con la Logica de Token

| Archivo | Funcion | Proposito |
|---------|---------|-----------|
| `apps/mobile/src/api/client.ts` | `setCachedToken()` | Guarda token en memoria |
| `apps/mobile/src/api/client.ts` | `getCachedToken()` | Lee token cacheado |
| `apps/mobile/src/api/client.ts` | `getAuthToken()` | Prioridad: cachedToken > SecureStore > test-token |
| `apps/mobile/src/context/AuthContext.tsx` | `loginWithGoogle()` | `setCachedToken()` + reset `lastSyncAt` + `runSync()` |
| `apps/mobile/src/context/AuthContext.tsx` | `completeOnboarding()` | `setCachedToken()` + reset `lastSyncAt` + `runSync()` |
| `apps/mobile/src/context/AuthContext.tsx` | `logout()` | `setCachedToken(null)` + reset `lastSyncAt` |
| `apps/mobile/src/sync/syncRunner.ts` | `runSync()` | PUSH (cola de sync_operations) + PULL (cambios del backend) |
| `apps/mobile/src/context/SyncContext.tsx` | `triggerSync()` | Dispara sync desde UI o polling 60s |
| `backend/src/auth/supabase.guard.ts` | `canActivate()` | Valida JWT, busca usuario, setea tenantId |
| `backend/src/sync/sync.service.ts` | `pullChanges()` | Devuelve registros con `updatedAt > lastSyncAt` |

---

## Comandos de Debug

```bash
# Verificar backend health
curl http://localhost:3001/api/v1/health

# Verificar que el pull endpoint funciona (usuario demo)
curl "http://localhost:3001/api/v1/sync/pull" \
  -H "Authorization: Bearer test-token" \
  -H "X-Device-Id: debug" | jq '.changes | group_by(.entity_type) | map({type: .[0].entity_type, count: length})'

# Ver tabla device_state en SQLite (desde el celu con una app SQLite viewer)
SELECT * FROM device_state;

# Ver operaciones pendientes
SELECT entity_type, operation, status, retries FROM sync_operations ORDER BY created_at DESC;

# Listar productos locales
SELECT id, name, barcode, stock FROM products WHERE is_active = 1;
```

---

## User Sync: Lecciones Aprendidas (2026-07-01)

### Problema: Usuarios del celular no aparecen en la web

**Causa raiz (3 bugs simultaneos):**

1. **Email duplicado en el celular:** El `EmployeeManagementScreen` validaba formato de email pero NO unicidad. Se podian crear 3 empleados con el mismo email (`ventu@ventu.com`) y distintos roles. El backend hace upsert por `email` (unique constraint), asi que los 3 se fusionaban en 1 solo usuario (ultimo rol gana).

2. **Operaciones duplicadas en la cola:** `migrateLocalUsers()` enqueueaba sync operations sin verificar si ya existia una pendiente para el mismo `entity_id`. Esto generaba duplicados.

3. **Web no refrescaba:** La pagina de empleados usaba `fetch` directo sin `staleTime`, cargando datos viejos despues del push.

### Solucion aplicada

| Archivo | Cambio |
|---------|--------|
| `modules/employees/index.ts` | Agregado `isEmailTaken()` — valida unicidad de email en SQLite local |
| `screens/EmployeeManagementScreen.tsx` | Llama `isEmailTaken()` antes de guardar, muestra error si el email ya existe |
| `context/AuthContext.tsx` | `migrateLocalUsers()` ahora verifica que no haya operacion pendiente para el mismo `entity_id` antes de enqueuear |
| `web/app/dashboard/employees/page.tsx` | Usa `apiFetch` + `staleTime: 10s` en vez de `fetch` directo |
| `backend/sync/sync.service.ts` | Logging de PUSH user con email, role y tenantId para debug |

### Regla: Email unico por tenant

```typescript
// En el celular, antes de guardar un empleado:
const emailTaken = await isEmailTaken(db, email, tenantId, editingEmployee?.id);
if (emailTaken) {
  setFormError('Este correo ya esta registrado por otro empleado.');
  return;
}
```

El backend tiene `email @unique` en el modelo User de Prisma. El upsert por email es correcto (evita duplicados), pero el celular debe prevenir el problema ANTES de encolar.

### Regla: No duplicar operaciones de sync

```typescript
// Antes de enqueuear, verificar que no exista una pendiente:
const existing = await db.getFirstAsync(
  `SELECT id FROM sync_operations
   WHERE entity_type = 'user' AND entity_id = $entity_id AND status = 'pending'`,
  { $entity_id: u.id },
);
if (existing) continue; // Ya hay una pendiente, no duplicar
```
