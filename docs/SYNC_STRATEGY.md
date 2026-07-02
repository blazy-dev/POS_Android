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
