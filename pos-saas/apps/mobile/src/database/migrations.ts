import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AppMetaRecord,
  AppMetaValue,
  CategoryRecord,
  CustomerRecord,
  InventoryMovementRecord,
  ProductRecord,
  SaleItemRecord,
  SaleRecord,
  SyncOperationRecord,
  SyncOperationStatus,
} from './types';

export const DATABASE_NAME = 'pos_local.db';
export const DATABASE_VERSION = 5;

const META_TABLE = 'app_meta';
const SYNC_TABLE = 'sync_operations';
const DEVICE_TABLE = 'device_state';
const PRODUCTS_TABLE = 'products';
const CATEGORIES_TABLE = 'categories';
const CUSTOMERS_TABLE = 'customers';
const SALES_TABLE = 'sales';
const SALE_ITEMS_TABLE = 'sale_items';
const INVENTORY_TABLE = 'inventory_movements';
const USERS_TABLE = 'users';
const CASH_REGISTERS_TABLE = 'cash_registers';

/**
 * Inicializa la base de datos local, aplicando configuraciones de PRAGMA y
 * creando el esquema de tablas si no existen.
 *
 * @param db Instancia de la base de datos SQLite proporcionada por expo-sqlite
 */
export async function initializeDatabase(db: SQLiteDatabase) {
  // Configura optimizaciones de SQLite:
  // - WAL (Write-Ahead Logging) para permitir lecturas concurrentes con escrituras y mejor rendimiento.
  // - ON (Foreign Keys) para forzar la integridad referencial en relaciones.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  // Obtiene la versión actual del esquema en el archivo de base de datos
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > 0 && currentVersion < 3) {
    // Reset database for version 3 migration (due to ID format change to standard UUIDs)
    await db.execAsync(`
      DROP TABLE IF EXISTS ${SALE_ITEMS_TABLE};
      DROP TABLE IF EXISTS ${INVENTORY_TABLE};
      DROP TABLE IF EXISTS ${SALES_TABLE};
      DROP TABLE IF EXISTS ${PRODUCTS_TABLE};
      DROP TABLE IF EXISTS ${CASH_REGISTERS_TABLE};
      DROP TABLE IF EXISTS ${USERS_TABLE};
      DROP TABLE IF EXISTS ${SYNC_TABLE};
      DROP TABLE IF EXISTS ${DEVICE_TABLE};
      DROP TABLE IF EXISTS ${META_TABLE};
    `);
  }

  // Migración incremental para la versión 5 (inmutabilidad de ventas)
  if (currentVersion > 0 && currentVersion < 5) {
    try {
      // 1. Agregar las nuevas columnas para inmutabilidad descriptiva en la tabla local
      await db.execAsync(`
        ALTER TABLE ${SALE_ITEMS_TABLE} ADD COLUMN product_name TEXT DEFAULT '';
        ALTER TABLE ${SALE_ITEMS_TABLE} ADD COLUMN product_unit TEXT DEFAULT 'unit';
      `);
      
      // 2. Rellenar de forma retroactiva con los nombres y unidades actuales para los registros existentes
      await db.execAsync(`
        UPDATE ${SALE_ITEMS_TABLE}
        SET product_name = (SELECT name FROM products WHERE id = product_id),
            product_unit = (SELECT unit FROM products WHERE id = product_id)
        WHERE product_name IS NULL OR product_name = '';
      `);
    } catch (err) {
      console.warn('Error al aplicar migración incremental v5 (SQLite):', err);
    }
  }

  // Ejecuta la creación del esquema DDL (Data Definition Language)
  await db.execAsync(`
    -- Tabla de usuarios locales para login por PIN
    CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      pin TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tabla de sesiones de caja (Cash Register Sessions)
    CREATE TABLE IF NOT EXISTS ${CASH_REGISTERS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      opened_by TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_amount REAL NOT NULL,
      closing_amount REAL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (opened_by) REFERENCES ${USERS_TABLE}(id)
    );

    -- Tabla para almacenar configuraciones globales persistentes de la app (clave-valor)
    CREATE TABLE IF NOT EXISTS ${META_TABLE} (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tabla de cola de operaciones pendientes de sincronización hacia el servidor (Offline-First)
    CREATE TABLE IF NOT EXISTS ${SYNC_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,          -- Tabla afectada (ej: 'products', 'sales')
      entity_id TEXT NOT NULL,            -- UUID de la fila en esa tabla
      operation TEXT NOT NULL,            -- 'create', 'update', 'delete'
      payload TEXT NOT NULL,              -- JSON con los campos de la entidad
      status TEXT NOT NULL DEFAULT 'pending', -- Estado del envío
      retries INTEGER NOT NULL DEFAULT 0, -- Cantidad de fallos consecutivos
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Índice para optimizar la obtención de registros pendientes ordenados por antigüedad
    CREATE INDEX IF NOT EXISTS idx_sync_operations_status_created_at
      ON ${SYNC_TABLE} (status, created_at);

    -- Tabla que guarda la identificación y el estado del dispositivo actual (Single-row table)
    CREATE TABLE IF NOT EXISTS ${DEVICE_TABLE} (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      device_id TEXT NOT NULL,            -- UUID o cadena identificadora única del dispositivo
      app_version TEXT NOT NULL,          -- Versión de la app móvil instalada
      last_sync_at TEXT,                  -- Fecha/hora de última sincronización exitosa
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tabla de catálogo local de productos
    CREATE TABLE IF NOT EXISTS ${PRODUCTS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,            -- tenant_id para compatibilidad SaaS
      barcode TEXT,                       -- Código de barras (puede ser nulo)
      name TEXT NOT NULL,
      category_id TEXT,
      purchase_price REAL NOT NULL DEFAULT 0, -- Costo del producto
      sale_price REAL NOT NULL DEFAULT 0,     -- Precio de venta al público
      stock REAL NOT NULL DEFAULT 0,          -- Cantidad física actual (REAL soporta decimales)
      unit TEXT NOT NULL DEFAULT 'unit',      -- Unidad: 'unit', 'kg', 'lt', etc.
      is_active INTEGER NOT NULL DEFAULT 1,   -- 1 = Activo, 0 = Inactivo (eliminado lógico)
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (tenant_id, barcode)            -- Asegura código de barras único por tenant/empresa
    );

    -- Índices para búsquedas rápidas en el catálogo local de productos
    CREATE INDEX IF NOT EXISTS idx_products_tenant_name
      ON ${PRODUCTS_TABLE} (tenant_id, name);

    CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode
      ON ${PRODUCTS_TABLE} (tenant_id, barcode);

    -- Tabla cabecera de Ventas / Tickets
    CREATE TABLE IF NOT EXISTS ${SALES_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      cash_register_id TEXT,             -- Sesión de caja abierta asociada
      customer_id TEXT,
      user_id TEXT,                      -- Empleado que realiza la transacción
      total REAL NOT NULL DEFAULT 0,     -- Total de la venta
      payment_method TEXT NOT NULL,      -- cash, card, etc.
      status TEXT NOT NULL,              -- completed, cancelled
      device_id TEXT NOT NULL,           -- Dispositivo que generó la venta
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Índice para listar el historial de ventas ordenado por fecha
    CREATE INDEX IF NOT EXISTS idx_sales_tenant_created_at
      ON ${SALES_TABLE} (tenant_id, created_at DESC);

    -- Tabla detalle de ítems de ventas
    CREATE TABLE IF NOT EXISTS ${SALE_ITEMS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,             -- FKey a cabecera de venta
      product_id TEXT,                   -- FKey al producto vendido (NULLable)
      product_name TEXT NOT NULL,        -- Nombre del producto vendido (inmutable)
      product_unit TEXT NOT NULL DEFAULT 'unit', -- Unidad de medida vendida (inmutable)
      quantity REAL NOT NULL,            -- Cantidad vendida
      unit_price REAL NOT NULL,          -- Precio cobrado
      subtotal REAL NOT NULL,            -- quantity * unit_price
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES ${SALES_TABLE}(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES ${PRODUCTS_TABLE}(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
      ON ${SALE_ITEMS_TABLE} (sale_id);

    -- Tabla de historial/kardex de movimientos de inventario local
    CREATE TABLE IF NOT EXISTS ${INVENTORY_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      product_id TEXT NOT NULL,          -- Producto afectado
      user_id TEXT,                      -- Usuario responsable
      reference_type TEXT NOT NULL,      -- 'sale', 'adjustment', etc.
      reference_id TEXT NOT NULL,        -- ID de entidad asociada (ej. sale_id)
      movement_type TEXT NOT NULL,       -- 'in' (ingreso), 'out' (egreso)
      quantity REAL NOT NULL,            -- Cantidad del movimiento
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES ${PRODUCTS_TABLE}(id)
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_product_created_at
      ON ${INVENTORY_TABLE} (product_id, created_at DESC);

    -- Tabla de categorias de productos (sincronizada desde el backend)
    CREATE TABLE IF NOT EXISTS ${CATEGORIES_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tabla de clientes (sincronizada desde el backend)
    CREATE TABLE IF NOT EXISTS ${CUSTOMERS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Actualiza la version de usuario en SQLite si es necesario
  if (currentVersion < DATABASE_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  }

  // Genera o lee el estado del dispositivo al arrancar
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO ${DEVICE_TABLE} (id, device_id, app_version, last_sync_at, created_at, updated_at)
     VALUES (1, $device_id, $app_version, NULL, $created_at, $updated_at)`,
    {
      $device_id: `device-${createdAt.replace(/[:.]/g, '-')}`,
      $app_version: '1.0.0',
      $created_at: createdAt,
      $updated_at: createdAt,
    },
  );

  // Sembrar usuarios por defecto para pruebas offline (Admin: 1234, Cajero: 4321)
  await db.runAsync(
    `INSERT OR IGNORE INTO ${USERS_TABLE} (id, tenant_id, name, email, pin, role, is_active, created_at, updated_at)
     VALUES ($admin_id, 'local', 'Administrador', 'admin@pos.local', '1234', 'admin', 1, $now, $now)`,
    {
      $admin_id: 'user-admin-uuid-000000000001',
      $now: createdAt,
    },
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO ${USERS_TABLE} (id, tenant_id, name, email, pin, role, is_active, created_at, updated_at)
     VALUES ($cashier_id, 'local', 'Cajero de Prueba', 'cajero@pos.local', '4321', 'cashier', 1, $now, $now)`,
    {
      $cashier_id: 'user-cashier-uuid-000000000002',
      $now: createdAt,
    },
  );
}

/**
 * Guarda o actualiza un valor de metadatos en la base de datos (clave-valor).
 */
export async function setAppMeta(
  db: SQLiteDatabase,
  key: string,
  value: AppMetaValue,
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO ${META_TABLE} (key, value, updated_at)
     VALUES ($key, $value, $updated_at)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    {
      $key: key,
      $value: JSON.stringify(value),
      $updated_at: now,
    },
  );
}

/**
 * Recupera un metadato de la tabla local 'app_meta' y lo parsea a su tipo correspondiente.
 */
export async function getAppMeta<T extends AppMetaValue>(
  db: SQLiteDatabase,
  key: string,
) {
  const row = await db.getFirstAsync<AppMetaRecord>(
    `SELECT key, value, updated_at FROM ${META_TABLE} WHERE key = $key`,
    { $key: key },
  );

  if (!row) {
    return null;
  }

  return JSON.parse(row.value) as T;
}

/**
 * Encola una nueva operación en la cola de sincronización para procesamiento diferido (Offline-First).
 */
export async function enqueueSyncOperation(
  db: SQLiteDatabase,
  operation: {
    id: string;
    entityType: string;
    entityId: string;
    kind: SyncOperationRecord['operation'];
    payload: unknown;
  },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO ${SYNC_TABLE} (
      id,
      entity_type,
      entity_id,
      operation,
      payload,
      status,
      retries,
      created_at,
      updated_at
    ) VALUES (
      $id,
      $entity_type,
      $entity_id,
      $operation,
      $payload,
      $status,
      $retries,
      $created_at,
      $updated_at
    )`,
    {
      $id: operation.id,
      $entity_type: operation.entityType,
      $entity_id: operation.entityId,
      $operation: operation.kind,
      $payload: JSON.stringify(operation.payload),
      $status: 'pending' satisfies SyncOperationStatus,
      $retries: 0,
      $created_at: now,
      $updated_at: now,
    },
  );
}

/**
 * Obtiene todas las operaciones pendientes de sincronizar con el backend, en orden cronológico.
 */
export async function listPendingSyncOperations(db: SQLiteDatabase) {
  return db.getAllAsync<SyncOperationRecord>(
    `SELECT
      id,
      entity_type,
      entity_id,
      operation,
      payload,
      status,
      retries,
      created_at,
      updated_at
     FROM ${SYNC_TABLE}
     WHERE status = $status
     ORDER BY created_at ASC`,
    { $status: 'pending' },
  );
}

/**
 * Devuelve la cantidad de productos creados localmente para un tenant específico.
 */
export async function getProductsCount(db: SQLiteDatabase, tenantId = 'local') {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${PRODUCTS_TABLE} WHERE tenant_id = $tenant_id`,
    { $tenant_id: tenantId },
  );

  return row?.count ?? 0;
}

/**
 * Devuelve la cantidad total de ventas registradas localmente para un tenant.
 */
export async function getSalesCount(db: SQLiteDatabase, tenantId = 'local') {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${SALES_TABLE} WHERE tenant_id = $tenant_id`,
    { $tenant_id: tenantId },
  );

  return row?.count ?? 0;
}

/**
 * Obtiene la lista completa de productos locales, ordenados por última actualización.
 */
export async function listProducts(db: SQLiteDatabase, tenantId = 'local') {
  return db.getAllAsync<ProductRecord>(
    `SELECT
      id,
      tenant_id,
      barcode,
      name,
      category_id,
      purchase_price,
      sale_price,
      stock,
      unit,
      is_active,
      created_at,
      updated_at
     FROM ${PRODUCTS_TABLE}
     WHERE tenant_id = $tenant_id AND is_active = 1
     ORDER BY updated_at DESC`,
    { $tenant_id: tenantId },
  );
}

/**
 * Obtiene las últimas 20 ventas registradas localmente, ordenadas de más reciente a más antigua.
 */
export async function listRecentSales(db: SQLiteDatabase, tenantId = 'local') {
  return db.getAllAsync<SaleRecord>(
    `SELECT
      id,
      tenant_id,
      cash_register_id,
      customer_id,
      user_id,
      total,
      payment_method,
      status,
      device_id,
      created_at,
      updated_at
     FROM ${SALES_TABLE}
     WHERE tenant_id = $tenant_id
     ORDER BY created_at DESC
     LIMIT 20`,
    { $tenant_id: tenantId },
  );
}

/**
 * Obtiene el detalle de artículos vendidos en una venta específica.
 */
export async function listSaleItems(db: SQLiteDatabase, saleId: string) {
  return db.getAllAsync<SaleItemRecord>(
    `SELECT
      id,
      tenant_id,
      sale_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      created_at,
      updated_at
     FROM ${SALE_ITEMS_TABLE}
     WHERE sale_id = $sale_id
     ORDER BY created_at ASC`,
    { $sale_id: saleId },
  );
}

/**
 * Devuelve la lista de categorias locales.
 */
export async function listCategories(db: SQLiteDatabase, tenantId = 'local') {
  return db.getAllAsync<CategoryRecord>(
    `SELECT id, tenant_id, name, created_at, updated_at
     FROM ${CATEGORIES_TABLE}
     WHERE tenant_id = $tenant_id
     ORDER BY name ASC`,
    { $tenant_id: tenantId },
  );
}

/**
 * Devuelve la lista de clientes locales.
 */
export async function listCustomers(db: SQLiteDatabase, tenantId = 'local') {
  return db.getAllAsync<CustomerRecord>(
    `SELECT id, tenant_id, name, phone, email, address, created_at, updated_at
     FROM ${CUSTOMERS_TABLE}
     WHERE tenant_id = $tenant_id
     ORDER BY name ASC`,
    { $tenant_id: tenantId },
  );
}

/**
 * Obtiene el historial completo de movimientos de stock para un producto en particular.
 */
export async function listInventoryMovements(
  db: SQLiteDatabase,
  productId: string,
) {
  return db.getAllAsync<InventoryMovementRecord>(
    `SELECT
      id,
      tenant_id,
      product_id,
      user_id,
      reference_type,
      reference_id,
      movement_type,
      quantity,
      created_at,
      updated_at
     FROM ${INVENTORY_TABLE}
     WHERE product_id = $product_id
     ORDER BY created_at DESC`,
    { $product_id: productId },
  );
}
