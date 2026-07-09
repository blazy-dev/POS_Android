import type { SQLiteDatabase } from 'expo-sqlite';
import {
  enqueueSyncOperation,
  listProducts as listProductsQuery,
  getAppMeta,
  getProductsCount,
} from '../../database';
import type { ProductRecord } from '../../database/types';
import { createLocalId } from '../../utils/ids';

export interface ProductInput {
  barcode?: string | null;
  name: string;
  categoryId?: string | null;
  purchasePrice?: number;
  salePrice?: number;
  stock?: number;
  unit?: string;
  tenantId?: string;
}

function normalizeBarcode(barcode?: string | null) {
  const trimmed = barcode?.trim();
  return trimmed ? trimmed : null;
}

export async function listProducts(db: SQLiteDatabase, tenantId = 'local') {
  return listProductsQuery(db, tenantId);
}

export async function isBarcodeTaken(
  db: SQLiteDatabase,
  barcode: string,
  tenantId = 'local',
  excludeProductId?: string,
) {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    return false;
  }

  const existing = await findProductByBarcode(db, normalizedBarcode, tenantId);

  if (!existing) {
    return false;
  }

  if (excludeProductId && existing.id === excludeProductId) {
    return false;
  }

  return true;
}

export async function saveProduct(db: SQLiteDatabase, input: ProductInput) {
  const now = new Date().toISOString();
  const tenantId = input.tenantId ?? 'local';

  // Validar límite de la versión Demo (máx. 20 productos)
  const statusMeta = await getAppMeta<string>(db, `tenant_subscription_status_${tenantId}`);
  if (statusMeta !== 'active') {
    const productsCount = await getProductsCount(db, tenantId);
    if (productsCount >= 20) {
      return ''; // Retorna vacío silenciosamente para no disparar pantalla roja en Expo
    }
  }

  const productId = createLocalId('product');
  const stock = input.stock ?? 0;
  const barcode = normalizeBarcode(input.barcode);

  if (barcode && (await isBarcodeTaken(db, barcode, tenantId))) {
    throw new Error('Ya existe un producto con este código de barras.');
  }

  await db.runAsync(
    `INSERT INTO products (
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
    ) VALUES (
      $id,
      $tenant_id,
      $barcode,
      $name,
      $category_id,
      $purchase_price,
      $sale_price,
      $stock,
      $unit,
      1,
      $created_at,
      $updated_at
    )`,
    {
      $id: productId,
      $tenant_id: tenantId,
      $barcode: barcode,
      $name: input.name,
      $category_id: input.categoryId ?? null,
      $purchase_price: input.purchasePrice ?? 0,
      $sale_price: input.salePrice ?? 0,
      $stock: stock,
      $unit: input.unit ?? 'unit',
      $created_at: now,
      $updated_at: now,
    },
  );

  if (stock > 0) {
    const movementId = createLocalId('movement');
    await db.runAsync(
      `INSERT INTO inventory_movements (
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
      ) VALUES (
        $id,
        $tenant_id,
        $product_id,
        NULL,
        'product',
        $reference_id,
        'in',
        $quantity,
        $created_at,
        $updated_at
      )`,
      {
        $id: movementId,
        $tenant_id: tenantId,
        $product_id: productId,
        $reference_id: productId,
        $quantity: stock,
        $created_at: now,
        $updated_at: now,
      },
    );
  }

  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'product',
    entityId: productId,
    kind: 'create',
    payload: {
      id: productId,
      tenant_id: tenantId,
      barcode,
      name: input.name,
      category_id: input.categoryId ?? null,
      purchase_price: input.purchasePrice ?? 0,
      sale_price: input.salePrice ?? 0,
      stock,
      unit: input.unit ?? 'unit',
    },
  });

  barcodeCache.clear();
  return productId;
}

/**
 * Actualiza un producto existente en la base de datos SQLite local y
 * registra una operación de sincronización de tipo 'update'.
 *
 * @param db Instancia de SQLiteDatabase
 * @param productId UUID del producto a editar
 * @param input Datos modificados del producto (excluyendo el stock)
 */
export async function updateProduct(
  db: SQLiteDatabase,
  productId: string,
  input: Omit<ProductInput, 'stock'>,
) {
  const now = new Date().toISOString();
  const tenantId = input.tenantId ?? 'local';
  const barcode = normalizeBarcode(input.barcode);

  // Valida que el código de barras no esté en uso por otro producto diferente a este
  if (barcode && (await isBarcodeTaken(db, barcode, tenantId, productId))) {
    throw new Error('Ya existe un producto con este código de barras.');
  }

  // Ejecuta la actualización en la tabla products
  await db.runAsync(
    `UPDATE products
     SET barcode = $barcode,
         name = $name,
         category_id = $category_id,
         purchase_price = $purchase_price,
         sale_price = $sale_price,
         unit = $unit,
         updated_at = $updated_at
     WHERE id = $id AND tenant_id = $tenant_id`,
    {
      $id: productId,
      $tenant_id: tenantId,
      $barcode: barcode,
      $name: input.name,
      $category_id: input.categoryId ?? null,
      $purchase_price: input.purchasePrice ?? 0,
      $sale_price: input.salePrice ?? 0,
      $unit: input.unit ?? 'unit',
      $updated_at: now,
    },
  );

  // Encola la operación en la cola de sincronización diferida
  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'product',
    entityId: productId,
    kind: 'update',
    payload: {
      id: productId,
      tenant_id: tenantId,
      barcode,
      name: input.name,
      category_id: input.categoryId ?? null,
      purchase_price: input.purchasePrice ?? 0,
      sale_price: input.salePrice ?? 0,
      unit: input.unit ?? 'unit',
    },
  });
  barcodeCache.clear();
}

/**
 * Registra un ajuste de stock (entrada o salida) para un producto, actualizando su cantidad actual
 * en la tabla products y registrando la auditoría en la tabla inventory_movements.
 *
 * @param db Instancia de SQLiteDatabase
 * @param productId UUID del producto a ajustar
 * @param type Dirección del movimiento: 'in' (entrada/reposición) o 'out' (salida/pérdida)
 * @param quantity Cantidad física a ajustar (positiva)
 * @param reason Motivo descriptivo del ajuste
 * @param tenantId ID de la empresa (multi-tenant)
 */
export async function adjustStock(
  db: SQLiteDatabase,
  productId: string,
  type: 'in' | 'out',
  quantity: number,
  reason: string,
  tenantId = 'local',
) {
  if (quantity <= 0) {
    throw new Error('La cantidad del ajuste debe ser mayor a cero.');
  }

  const now = new Date().toISOString();
  const movementId = createLocalId('movement');
  const adjustmentId = createLocalId('adj');

  await db.withExclusiveTransactionAsync(async (txn) => {
    // 1. Obtener stock actual para validar y actualizar
    const product = await txn.getFirstAsync<{ stock: number }>(
      `SELECT stock FROM products WHERE id = $id AND tenant_id = $tenant_id`,
      { $id: productId, $tenant_id: tenantId },
    );

    if (!product) {
      throw new Error('No se encontró el producto especificado.');
    }

    let nextStock = product.stock;
    if (type === 'in') {
      nextStock += quantity;
    } else {
      if (product.stock < quantity) {
        throw new Error(
          `Stock insuficiente para realizar la salida. Stock actual: ${product.stock}`,
        );
      }
      nextStock -= quantity;
    }

    // 2. Actualizar el stock en la tabla products
    await txn.runAsync(
      `UPDATE products
       SET stock = $stock,
           updated_at = $updated_at
       WHERE id = $id AND tenant_id = $tenant_id`,
      {
        $stock: nextStock,
        $updated_at: now,
        $id: productId,
        $tenant_id: tenantId,
      },
    );

    // 3. Registrar el movimiento en inventory_movements
    await txn.runAsync(
      `INSERT INTO inventory_movements (
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
      ) VALUES (
        $id,
        $tenant_id,
        $product_id,
        NULL,
        'adjustment',
        $reference_id,
        $movement_type,
        $quantity,
        $created_at,
        $updated_at
      )`,
      {
        $id: movementId,
        $tenant_id: tenantId,
        $product_id: productId,
        $reference_id: adjustmentId,
        $movement_type: type,
        $quantity: quantity,
        $created_at: now,
        $updated_at: now,
      },
    );
  });

  // 4. Encolar la operación de sincronización diferida
  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'inventory_movement',
    entityId: movementId,
    kind: 'create',
    payload: {
      id: movementId,
      tenant_id: tenantId,
      product_id: productId,
      user_id: null,
      reference_type: 'adjustment',
      reference_id: adjustmentId,
      movement_type: type,
      quantity,
      reason, // Se guarda el motivo en el payload para sincronizar
      created_at: now,
    },
  });
  barcodeCache.clear();
}

interface CacheEntry {
  product: ProductRecord | null;
  timestamp: number;
}

const barcodeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 60s en ms

export async function findProductByBarcode(
  db: SQLiteDatabase,
  barcode: string,
  tenantId = 'local',
): Promise<ProductRecord | null> {
  const normalizedBarcode = normalizeBarcode(barcode);

  if (!normalizedBarcode) {
    return null;
  }

  const cacheKey = `${tenantId}:${normalizedBarcode}`;
  const cached = barcodeCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.product;
  }

  const result = await db.getFirstAsync<ProductRecord>(
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
     FROM products
     WHERE tenant_id = $tenant_id AND barcode = $barcode AND is_active = 1`,
    {
      $tenant_id: tenantId,
      $barcode: normalizedBarcode,
    },
  );

  barcodeCache.set(cacheKey, {
    product: result,
    timestamp: now,
  });

  return result;
}

/**
 * Realiza la eliminación lógica (soft delete) de un producto localmente
 * y registra la operación en la cola de sincronización.
 */
export async function deleteProduct(
  db: SQLiteDatabase,
  productId: string,
  tenantId = 'local',
) {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE products
     SET is_active = 0,
         updated_at = $updated_at
     WHERE id = $id AND tenant_id = $tenant_id`,
    {
      $id: productId,
      $tenant_id: tenantId,
      $updated_at: now,
    },
  );

  // Registrar operación de sincronización en la cola offline
  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'product',
    entityId: productId,
    kind: 'delete',
    payload: {
      id: productId,
      tenant_id: tenantId,
    },
  });
  barcodeCache.clear();
}
