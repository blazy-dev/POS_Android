# Arquitectura de Inmutabilidad de Ventas y Consistencia Transaccional

Este documento explica cómo el sistema maneja (y cómo debe manejar de forma definitiva en producción) la consistencia de los montos de ventas, cantidades y nombres históricos cuando se modifican los productos en el catálogo (cambios de nombre, precio, código de barras o eliminación).

---

## 🚨 El Problema Detectado: Recalculos Dinámicos

En un sistema transaccional (como un Punto de Venta), **las ventas y sus arqueos de caja deben ser fotos fijas, inmutables e independientes del estado actual del catálogo**. 

Actualmente, las consultas de reportes de ventas y arqueos de caja en la base de datos local de la aplicación móvil realizan joins dinámicos contra la tabla de productos. Por ejemplo, en la consulta de arqueo de caja (`getSessionSalesWithItems`):

```sql
SELECT 
   si.sale_id,
   p.name AS product_name,   -- Dependencia dinámica de products p
   p.unit AS product_unit,   -- Dependencia dinámica de products p
   si.quantity,
   si.unit_price,
   si.subtotal
 FROM sale_items si
 JOIN products p ON si.product_id = p.id
```

### 💣 Consecuencias de esta dependencia dinámica:
1. **Si cambias el nombre** de "Gaseosa A" a "Gaseosa Modificada", los reportes de ventas de hace un mes pasarán a mostrar "Gaseosa Modificada" en lugar del nombre con el que se vendió.
2. **Si el producto se elimina físicamente** de la tabla `products`, el `JOIN` interior (que requiere que el ID del producto exista en la tabla `products`) causará que el registro del ítem **desaparezca por completo de los reportes**, haciendo que el total de la venta o del arqueo de caja se muestre inconsistente o baje a `0`.
3. **Si el producto cambia de precio** en el catálogo (ej: de $5000 a $8000), aunque `sale_items.unit_price` guarda $5000 (lo cual es correcto e inmutable), cualquier cálculo de reportes mal estructurado que multiplique la cantidad histórica por el precio actual de la tabla `products` distorsionará los ingresos del comercio.

---

## 🛡️ Principio de Inmutabilidad Histórica

Para que los montos no cambien a `0` y la información histórica permanezca intacta ante ediciones del catálogo, se implementan tres reglas arquitectónicas fundamentales:

```mermaid
flowchart TD
    subgraph Catálogo (Dinámico)
        P[Producto A<br>Precio: $8000]
    end
    subgraph Venta Registrada (Inmutable)
        S[Cabecera Venta<br>Total: $5000]
        SI[Sale Item<br>Nombre: Producto A<br>Precio Histórico: $5000<br>Subtotal: $5000]
    end
    P -.->|Edición de Precio/Nombre| P
    P -->|Se vendió a $5000| S
    P -->|Copia estática| SI
    style S fill:#dcfce7,stroke:#15803d,stroke-width:2px
    style SI fill:#dcfce7,stroke:#15803d,stroke-width:2px
```

### 1. Desnormalización de Datos (Copia Estática)
En el momento preciso en que se confirma el cobro de una venta, la aplicación realiza una **copia estática y desnormalizada** de los datos del producto directamente a la fila de la transacción.
* Se guarda el `unit_price` cobrado en ese instante.
* Se debe guardar el `product_name` textual y la `unit` (Unidad de Medida) en la tabla `sale_items` de forma permanente.

### 2. Claves Foráneas Flexibles (`ON DELETE SET NULL`)
Tanto en la base de datos local (SQLite) como en la base de datos del backend (PostgreSQL/Prisma), la relación entre los ítems de venta (`sale_items`) y la tabla de productos (`products`) debe tener la regla `ON DELETE SET NULL` o borrado lógico (`is_active = 0`):
* Si el producto se elimina físicamente, el campo `product_id` en la tabla `sale_items` pasa a ser `null`, pero la fila del ítem vendido **sobrevive** con su nombre histórico, precio cobrado y subtotal intactos.

### 3. Reportes Basados en Ventas, no en Productos
Los reportes diarios, arqueos de caja y estadísticas financieras leen **únicamente** de las tablas `sales` y `sale_items`. No necesitan hacer un `JOIN` con la tabla `products` para resolver el nombre o el precio.

---

## 📋 Comportamiento de Flujo: Casos Prácticos

### Caso A: Venta de Producto A ($5000) -> Cambio de Nombre a "Producto 1"
* **Qué pasa con la venta registrada:** Permanece intacta. El ticket histórico y los arqueos de caja siguen mostrando que se vendió el "Producto A" por $5000.
* **Cómo funciona:** La consulta de reportes lee el nombre del producto directamente de la columna `sale_items.product_name` (donde dice "Producto A"), ignorando la tabla de catálogo para este fin.

### Caso B: Cambio de Precio de Producto A ($5000) a $8000
* **Qué pasa con la venta registrada:** No sufre ninguna alteración. El total de la venta sigue siendo $5000.
* **Cómo funciona:** Al registrar la venta se guardó de forma estática `unit_price = 5000` y `subtotal = 5000` en la tabla de ítems de venta. El catálogo cambia su precio de venta de referencia para futuras transacciones, pero no afecta al histórico.

### Caso C: Cambio de Categoría o Código de Barras
* **Qué pasa con la venta registrada:** Los arqueos de caja y los reportes de ventas no muestran códigos de barra ni categorías dinámicas, leen la cabecera y el detalle de la venta inmutable. El cambio de código de barras no tiene impacto ya que la venta hace referencia al ID único inmutable del producto y no a su barcode.

---

## 🛠️ Plan de Remediación Técnica para Producción

Para robustecer este comportamiento y evitar cualquier reducción de montos a `0` bajo sincronización o cambios de catálogo, implementaremos los siguientes pasos en la base de datos local y el backend:

### 1. Modificación de Tablas (Migraciones)

#### SQLite (App Móvil)
Añadiremos las columnas `product_name` y `product_unit` a la tabla `sale_items`:
```sql
ALTER TABLE sale_items ADD COLUMN product_name TEXT;
ALTER TABLE sale_items ADD COLUMN product_unit TEXT;
```

#### Prisma (Backend)
Actualizaremos el modelo `SaleItem` en `schema.prisma`:
```prisma
model SaleItem {
  id           String   @id @default(uuid()) @db.Uuid
  saleId       String   @map("sale_id") @db.Uuid
  productId    String?  @map("product_id") @db.Uuid
  productName  String   @map("product_name") @db.VarChar(255)  // Guardado estático del nombre
  productUnit  String   @map("product_unit") @db.VarChar(50)   // Guardado estático de la unidad
  quantity     Decimal  @db.Decimal(12, 3)
  unitPrice    Decimal  @map("unit_price") @db.Decimal(12, 2)
  subtotal     Decimal  @db.Decimal(12, 2)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  sale    Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@map("sale_item")
}
```

### 2. Actualización de Consultas de Reportes (SQLite Local)

Modificaremos la consulta del arqueo de caja en `getSessionSalesWithItems` y en reportes para eliminar el `JOIN products` y leer directamente de la tabla `sale_items`:

```sql
SELECT 
   si.sale_id,
   si.product_name,    -- Directo del histórico inmutable
   si.product_unit,    -- Directo del histórico inmutable
   si.quantity,
   si.unit_price,
   si.subtotal
 FROM sale_items si
 JOIN sales s ON si.sale_id = s.id
 WHERE s.cash_register_id = $registerId
 ORDER BY si.created_at ASC
```

Con estas medidas, las operaciones en el catálogo serán 100% independientes de las ventas registradas, garantizando una contabilidad robusta y libre de errores en producción.

---

## 🐛 Bug Resuelto: Pérdida del Total post-sincronización con la Nube

### El Problema
Al realizar ventas offline, los ingresos locales y arqueos se mostraban correctamente debido a que SQLite guardaba el total local. Sin embargo, al sincronizarse con la nube (PUSH), los ingresos de la venta pasaban a `$0`.

Tras un análisis exhaustivo, se identificó que el payload enviado en la operación de sincronización (`SyncOperation`) **no incluía el campo `total` ni las fechas `created_at` / `updated_at` de la venta**. 

1. La app móvil encolaba la operación enviando únicamente datos de cabecera como el método de pago e items sin el total acumulado.
2. El backend de NestJS (`sync.service.ts`) al ejecutar `cleanSale` sobre la cabecera del payload, detectaba `payload.total === undefined`, asignándole por seguridad un valor por defecto de `$0`.
3. Al guardarse en la base de datos central de Postgres con un total de `$0`, la subsiguiente fase de sincronización descendente (PULL) bajaba el registro remoto al dispositivo móvil y ejecutaba un `ON CONFLICT(id) DO UPDATE SET total = excluded.total`.
4. Esto sobreescribía el total local correcto de SQLite con `$0`, vaciando a cero los ingresos, estadísticas de venta y arqueos del día.

### La Solución
1. Modificamos la función `createSale` en [sales/index.ts](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/pos-saas/apps/mobile/src/modules/sales/index.ts) para declarar y propagar la variable acumuladora `total` fuera del bloque de transacción de la base de datos.
2. Modificamos la creación de la operación de sincronización en `enqueueSyncOperation` para inyectar explícitamente `total: total`, `created_at: now` y `updated_at: now` en el payload.
3. Ahora la cabecera viaja con su monto y fecha histórica intactos, almacenándose en Postgres de forma robusta e impidiendo que el posterior PULL pise el total con `$0`.

