# SYNC SKELETON — Esqueleto de la Sincronización

Este documento describe el flujo completo de sincronización **Mobile → Backend → Web**, desde que el usuario hace una acción en el celular hasta que el cambio se refleja en el dashboard web (y viceversa).

Es el **esqueleto** que todo cambio en el sistema de sincronización debe respetar.

---

## El Problema que Resuelve

Cuando un empleado se elimina desde el móvil:
1. Se borra de la memoria interna del teléfono (SQLite)
2. Manda la petición al backend (Push)
3. El backend guarda el cambio en PostgreSQL
4. El backend **emite un evento** (SSE — Server-Sent Events) que dice: "algo cambió"
5. La web **recibe el evento**, identifica qué cambió (tipo: user, operación: delete, id: xxx)
6. La web invalida su caché local de React Query para ese tipo de entidad
7. React Query refetch automaticamente y la entidad desaparece de la UI

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     ECOSISTEMA POS                           │
├──────────────────┬──────────────────┬───────────────────────┤
│    MOBILE (App)  │   BACKEND (Nest) │    WEB (Next.js)      │
│                  │                  │                        │
│  SQLite (local)  │ PostgreSQL (global)│ React Query (caché)  │
│  sync_operations │ sync.service     │ SSE EventSource       │
│  syncRunner      │ event-bus (SSE)  │ SyncIndicator         │
└──────────────────┴──────────────────┴───────────────────────┘
```

---

## Flujo Paso a Paso: Eliminar Empleado desde Mobile

```
┌─────────────────────────┐
│  1. USUARIO TOCA "BAJA" │
│  EmployeeManagementScreen│
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  2. deleteEmployee()    │  ← apps/mobile/src/modules/employees/index.ts
│  ─────────────────────   │
│  a) UPDATE users SET    │
│     is_active = 0       │  ← Se desactiva en SQLite local
│     WHERE id = $id      │
│                         │
│  b) enqueueSyncOperation│  ← Se encola en sync_operations
│     { entityType: user, │     con status = 'pending'
│       kind: delete }    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  3. syncRunner.runSync()│  ← apps/mobile/src/sync/syncRunner.ts
│  ─────────────────────   │
│  a) Push: POST /sync/push
│     Body: { operations: [
│       { operation_id, entity_type: 'user',
│         entity_id, operation: 'delete',
│         payload: { id, tenant_id } }
│     ]}
│                         │
│  b) Si éxito → marca    │
│     sync_operation como │
│     status = 'synced'   │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  4. BACKEND: sync.service.pushOperations()           │
│  ─────────────────────────────────────────────       │
│  a) Valida JWT → extrae tenantId                    │
│  b) Registra/actualiza device en PostgreSQL         │
│  c) Por cada operación:                             │
│     i)   Upsert en syncOperation (log)              │
│     ii)  Ejecuta: UPDATE users SET is_active = 0    │
│           WHERE id = $entityId                      │
│     iii) EMITE EVENTO VIA EVENTBUS:                 │
│           eventBus.emit({                           │
│             entityType: 'user',                     │
│             operation: 'delete',                    │
│             entityId: 'uuid',                       │
│             tenantId: 'uuid',                       │
│             timestamp: '2026-07-02T...'             │
│           })                                        │
│  d) Crea auditLog del sync_push                    │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  5. EVENT BUS (SSE)                                   │
│  ─────────────────────                                 │
│  EventBusService (singleton in-memory)                │
│  Tiene una lista de subscribers (callbacks)           │
│  Cuando se llama emit(), itera subscribers:           │
│    → events.controller.ts tiene un Sse endpoint       │
│    → GET /api/v1/events                              │
│    → Cada conexión SSE registra un subscriber         │
│    → El evento se envía como SSE data frame           │
│                                                      │
│  Formato del mensaje SSE:                            │
│    data: {"entityType":"user","operation":"delete",   │
│           "entityId":"uuid","tenantId":"uuid",        │
│           "timestamp":"2026-07-02T..."}               │
│                                                      │
│  NOTA: No requiere auth — solo contiene IDs,          │
│  no datos sensibles. El refetch posterior usa auth.   │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  6. WEB: SyncIndicator.tsx (EventSource)              │
│  ──────────────────────────────────────────────       │
│  a) El componente monta un EventSource a:             │
│     http://localhost:3001/api/v1/events               │
│                                                      │
│  b) Cuando llega onmessage con el evento:            │
│     i)   Parsear JSON                                 │
│     ii)  entityType='user' → queryKey=['employees']   │
│     iii) queryClient.invalidateQueries({               │
│            queryKey: ['employees']                     │
│          })                                           │
│     iv)  Mostrar "Actualizado" status por 2s          │
│                                                      │
│  c) Si onerror → status='offline'                    │
│     Reconnect automático a los 5 segundos             │
│                                                      │
│  Mapa entityType → queryKey:                          │
│    product  → ['products']                            │
│    user     → ['employees']                           │
│    category → ['categories']                          │
│    customer → ['customers']                           │
│    sale     → ['sales']                               │
│    cash_register → ['cashRegisters']                  │
│    inventory_movement → ['inventoryMovements']        │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  7. REACT QUERY REFETCH                              │
│  ─────────────────────────                             │
│  React Query detecta que la query ['employees']       │
│  está invalidada → automaticamente ejecuta el         │
│  queryFn que es:                                      │
│    apiFetch('/dashboard/employees')                   │
│                                                      │
│  El backend responde SIN el empleado                  │
│  (isActive = false → no se incluye... o si se        │
│   incluye con isActive=false y la UI lo oculta)       │
│                                                      │
│  → El empleado DESAPARECE de la tabla en la web       │
└──────────────────────────────────────────────────────┘
```

---

## Flujo Inverso: Web → Mobile

```
1. Admin crea producto en dashboard web
   → POST /dashboard/products
   → Backend: INSERT en PostgreSQL (updatedAt = now)
   → EventBus.emit({ entityType: 'product', operation: 'create', ... })
   → Web recibe SSE → invalida ['products'] → tabla se actualiza
   
2. Mobile detecta cambio en próximo sync cycle
   → GET /sync/pull?lastSyncAt=...
   → Backend devuelve producto con updatedAt > lastSyncAt
   → SQLite: INSERT ON CONFLICT DO UPDATE
   → Producto aparece en el catálogo del celular
```

---

## Componentes Clave del Esqueleto

### 1. Mobile: Encadenar operación local + sync
Cada módulo (employees, products, etc.) sigue este patrón:
```typescript
async function deleteEmployee(db, id, tenantId) {
  // 1. Ejecutar en SQLite local
  await db.runAsync(`UPDATE users SET is_active = 0 WHERE id = $id`, { $id: id });
  
  // 2. Encolar operación de sync
  await enqueueSyncOperation(db, {
    entityType: 'user',
    entityId: id,
    kind: 'delete',
    payload: { id, tenant_id: tenantId },
  });
}
```

### 2. Backend: Procesar + Emitir evento
Cada operación push se procesa en `sync.service.ts` y **siempre** emite un evento SSE:
```typescript
// sync.service.ts - línea 340
this.eventBus.emit({
  entityType: entity_type,  // 'user' | 'product' | 'category' | etc.
  operation,                // 'create' | 'update' | 'delete'
  entityId: validEntityId,
  tenantId,
  timestamp: new Date().toISOString(),
});
```

Las operaciones del dashboard web TAMBIÉN emiten eventos (dashboard.controller.ts):
```typescript
private emit(entityType, operation, entityId, tenantId) {
  this.eventBus.emit({ entityType, operation, entityId, tenantId, timestamp: new Date().toISOString() });
}
```

### 3. Web: Escuchar eventos SSE + Invalidar caché
```typescript
const es = new EventSource(`${API_BASE}/events`);

es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const keys = ENTITY_TO_QUERY_KEY[data.entityType];
  if (keys) {
    keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
  }
};
```

---

## Reglas de Oro del Skeleton

| Regla | Descripción | Violación típica |
|-------|-------------|------------------|
| **R1** | Toda operación de escritura en SQLite debe encolar un sync | Olvidar `enqueueSyncOperation` después de un INSERT/UPDATE/DELETE |
| **R2** | Todo push procesado en backend debe emitir un evento SSE | Agregar un nuevo entity_type en sync.service.ts y no emitir evento |
| **R3** | Toda escritura desde web dashboard debe emitir un evento SSE | Dashboard.controller hace un CREATE sin llamar `this.emit()` |
| **R4** | Todo entity_type en SSE debe tener un queryKey mapeado en SyncIndicator | Agregar 'report' entity_type y no agregarlo en ENTITY_TO_QUERY_KEY |
| **R5** | El web nunca debe depender de SSE para datos críticos — SSE es solo para invalidar caché | Hacer que la UI dependa del evento SSE para mostrar datos, en vez de refetch |
| **R6** | SSE no requiere auth — los eventos solo llevan IDs | Agregar datos sensibles en el payload del evento SSE |

---

## Entity Types Registry

Cada vez que se agregue un nuevo tipo de entidad al sistema, actualizar estos 3 lugares:

| Dónde | Qué hacer |
|-------|-----------|
| `backend/src/sync/sync.service.ts` | Agregar el case en pushOperations (create/update/delete) y en pullChanges |
| `backend/src/dashboard/dashboard.controller.ts` | Si el web escribe esta entidad, emitir evento SSE |
| `apps/web/src/components/SyncIndicator.tsx` | Agregar el mapping entityType → queryKey en ENTITY_TO_QUERY_KEY |

---

## Debugging: Verificar que el esqueleto funciona

### Probar SSE manualmente
```bash
# Abrir conexión SSE en terminal (PowerShell)
curl.exe -N http://localhost:3001/api/v1/events
# Debería mostrar inmediatamente:
# data: {"entityType":"connection","operation":"connected","entityId":"","timestamp":"..."}
```

### Probar que un push genera evento SSE
```bash
# Hacer un push simulado
curl -X POST http://localhost:3001/api/v1/sync/push `
  -H "Authorization: Bearer test-token" `
  -H "Content-Type: application/json" `
  -H "X-Device-Id: debug-device" `
  -d '{"operations":[{"operation_id":"test-001","entity_type":"user","entity_id":"00000000-0000-0000-0000-000000000001","operation":"delete","payload":{"id":"00000000-0000-0000-0000-000000000001","tenant_id":"test"}}]}'

# En la terminal SSE debería aparecer:
# data: {"entityType":"user","operation":"delete","entityId":"00000000-0000-0000-0000-000000000001",...}
```

### Verificar caché de React Query en web
```javascript
// En la consola del navegador (dashboard web)
const queryClient = window.__QUERY_CLIENT__; // si está expuesto
// o buscar en React DevTools > QueryClient
queryClient.getQueryData(['employees'])
```

---

## Archivos que Implementan el Skeleton

| Archivo | Rol en el esqueleto |
|---------|---------------------|
| `apps/mobile/src/modules/employees/index.ts` | Operación local + encolar sync |
| `apps/mobile/src/sync/syncRunner.ts` | Push/Pull runner |
| `apps/mobile/src/database/types.ts` | Interfaz SyncOperation |
| `backend/src/sync/sync.service.ts` | Procesa push, emite evento SSE, genera pull |
| `backend/src/sync/sync.controller.ts` | Endpoints POST /push y GET /pull |
| `backend/src/events/event-bus.ts` | Bus de eventos in-memory (singleton) |
| `backend/src/events/events.controller.ts` | Endpoint SSE /api/v1/events |
| `backend/src/dashboard/dashboard.controller.ts` | CRUD web + emisión de eventos SSE |
| `apps/web/src/components/SyncIndicator.tsx` | Consumidor SSE, invalidación de caché, status UI |
| `apps/web/src/app/dashboard/layout.tsx` | Renderiza SyncIndicator en el header |

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2026-07-02 | Documento creado — esqueleto de sincronización Mobile→Backend→Web vía SSE |
