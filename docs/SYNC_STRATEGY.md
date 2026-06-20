# SYNC_STRATEGY.md

## Objetivo

Garantizar que la aplicación funcione correctamente sin conexión a internet y sincronice automáticamente la información cuando la conectividad esté disponible.

La operación del negocio nunca debe depender de internet.

---

## Principios

* Offline-first.
* PostgreSQL es la fuente de verdad global.
* SQLite es la fuente de verdad local temporal.
* Ninguna venta puede perderse.
* La sincronización debe ser automática.
* La sincronización no debe bloquear al usuario.

---

## Flujo general

```text
Usuario realiza una acción
           ↓
Se guarda en SQLite
           ↓
Se actualiza la interfaz
           ↓
Se registra una operación pendiente
           ↓
Si hay internet:
    sincronizar
Si no hay internet:
    esperar conexión
```

---

## Estrategia de sincronización

La sincronización se basa en operaciones, no en tablas.

Ejemplos de operaciones:

* Crear producto
* Actualizar producto
* Crear venta
* Ajustar inventario

Cada operación se almacena localmente.

---

## Tabla local: sync_operations

| Campo        | Tipo     |
| ------------ | -------- |
| id           | UUID     |
| operation_id | UUID     |
| entity_type  | TEXT     |
| entity_id    | UUID     |
| operation    | TEXT     |
| payload      | JSON     |
| status       | TEXT     |
| retries      | INTEGER  |
| created_at   | DATETIME |

### operation

* create
* update
* delete

### status

* pending
* syncing
* synced
* failed

---

## Flujo Push

La aplicación envía operaciones pendientes al backend.

```text
SQLite → API → PostgreSQL
```

Proceso:

1. Detectar operaciones pendientes.
2. Enviar lote al backend.
3. Confirmar recepción.
4. Marcar operaciones como sincronizadas.

Endpoint:

```http
POST /sync/push
```

---

## Flujo Pull

La aplicación obtiene cambios remotos.

```text
PostgreSQL → API → SQLite
```

Proceso:

1. Consultar la fecha de última sincronización.
2. Solicitar cambios.
3. Actualizar SQLite.

Endpoint:

```http
GET /sync/pull
```

---

## Orden de sincronización

1. Productos
2. Categorías
3. Clientes
4. Inventario
5. Caja
6. Ventas

---

## UUID

Todas las entidades utilizan UUID.

Esto evita conflictos entre dispositivos.

La aplicación genera los UUID localmente.

Ejemplo:

```text
sale_id = uuid_v7()
```

---

## Detección de conectividad

La aplicación debe detectar:

* Conexión disponible.
* Recuperación de conexión.
* Cambios de red.

Eventos que disparan sincronización:

* Inicio de sesión.
* Apertura de la aplicación.
* Recuperación de internet.
* Sincronización manual.
* Intervalo automático.

---

## Reintentos

Si una operación falla:

* Incrementar retries.
* Reintentar automáticamente.

Estrategia:

```text
1 min
2 min
5 min
15 min
30 min
```

Máximo:

```text
10 intentos
```

---

## Conflictos

Regla inicial del MVP:

```text
Última actualización gana.
```

Basado en:

```text
updated_at
```

Los conflictos críticos deben registrarse para revisión.

---

## Ventas

Las ventas nunca deben modificarse.

Una venta puede:

* Crearse.
* Anularse.

Nunca editarse.

Esto reduce conflictos.

---

## Inventario

El stock no se sincroniza directamente.

El stock se calcula a partir de movimientos.

Ejemplo:

```text
stock_actual =
stock_inicial +
entradas -
salidas
```

---

## Seguridad

Cada operación debe incluir:

* tenant_id
* device_id
* user_id

El backend valida:

* Permisos.
* Integridad.
* Duplicados.

---

## Idempotencia

Cada operación debe ejecutarse una sola vez.

El backend debe ignorar:

```text
operation_id
```

duplicados.

---

## Sincronización inicial

Al iniciar sesión por primera vez:

1. Registrar dispositivo.
2. Descargar datos iniciales.
3. Guardar en SQLite.
4. Registrar fecha de sincronización.

---

## Indicadores visuales

La aplicación debe mostrar:

* Sincronizado.
* Sin conexión.
* Sincronizando.
* Error de sincronización.

El usuario debe poder seguir vendiendo aunque exista un error.

---

## Objetivo final

El usuario nunca debe pensar en la sincronización.

Debe sentir que la aplicación funciona siempre.
