import type { SQLiteDatabase } from 'expo-sqlite';
import {
  enqueueSyncOperation,
  listRecentSales as listRecentSalesQuery,
} from '../../database';
import { createLocalId } from '../../utils/ids';
import { findProductByBarcode } from '../products';

export interface SaleLineInput {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  tenantId?: string;
  paymentMethod: string;
  userId?: string | null;
  customerId?: string | null;
  cashRegisterId?: string | null;
  deviceId?: string;
  items: SaleLineInput[];
}

export async function listRecentSales(db: SQLiteDatabase, tenantId = 'local') {
  return listRecentSalesQuery(db, tenantId);
}

export async function createSale(db: SQLiteDatabase, input: CreateSaleInput) {
  const tenantId = input.tenantId ?? 'local';
  const saleId = createLocalId('sale');
  const deviceId = input.deviceId ?? 'local-device';
  const now = new Date().toISOString();

  if (input.items.length === 0) {
    throw new Error('La venta debe incluir al menos un producto.');
  }

  const saleItemsPayload: any[] = [];

  await db.withExclusiveTransactionAsync(async (txn) => {
    let total = 0;

    for (const item of input.items) {
      const product = await txn.getFirstAsync<{
        id: string;
        sale_price: number;
        stock: number;
        name: string;
        unit: string;
      }>(
        `SELECT id, sale_price, stock, name, unit
         FROM products
         WHERE id = $product_id AND tenant_id = $tenant_id AND is_active = 1`,
        { $product_id: item.productId, $tenant_id: tenantId },
      );

      if (!product) {
        throw new Error(`No se encontró el producto ${item.productId}.`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      // Calcula el subtotal para este ítem: precio de venta * cantidad
      const subtotal = product.sale_price * item.quantity;
      total += subtotal;

      const saleItemId = createLocalId('sale_item');
      // Registra el detalle del producto vendido en la tabla 'sale_items'
      await txn.runAsync(
        `INSERT INTO sale_items (
          id,
          tenant_id,
          sale_id,
          product_id,
          product_name,
          product_unit,
          quantity,
          unit_price,
          subtotal,
          created_at,
          updated_at
        ) VALUES (
          $id,
          $tenant_id,
          $sale_id,
          $product_id,
          $product_name,
          $product_unit,
          $quantity,
          $unit_price,
          $subtotal,
          $created_at,
          $updated_at
        )`,
        {
          $id: saleItemId,
          $tenant_id: tenantId,
          $sale_id: saleId,
          $product_id: item.productId,
          $product_name: product.name,
          $product_unit: product.unit,
          $quantity: item.quantity,
          $unit_price: product.sale_price,
          $subtotal: subtotal,
          $created_at: now,
          $updated_at: now,
        },
      );

      saleItemsPayload.push({
        id: saleItemId,
        tenant_id: tenantId,
        sale_id: saleId,
        product_id: item.productId,
        product_name: product.name,
        product_unit: product.unit,
        quantity: item.quantity,
        unit_price: product.sale_price,
        subtotal: subtotal,
        created_at: now,
        updated_at: now,
      });

      await txn.runAsync(
        `UPDATE products
         SET stock = stock - $quantity,
             updated_at = $updated_at
         WHERE id = $product_id AND tenant_id = $tenant_id`,
        {
          $quantity: item.quantity,
          $updated_at: now,
          $product_id: item.productId,
          $tenant_id: tenantId,
        },
      );

      const movementId = createLocalId('movement');
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
          $user_id,
          'sale',
          $reference_id,
          'out',
          $quantity,
          $created_at,
          $updated_at
        )`,
        {
          $id: movementId,
          $tenant_id: tenantId,
          $product_id: item.productId,
          $user_id: input.userId ?? null,
          $reference_id: saleId,
          $quantity: item.quantity,
          $created_at: now,
          $updated_at: now,
        },
      );
    }

    // Inserta la cabecera de la venta con el total acumulado de todos los ítems
    await txn.runAsync(
      `INSERT INTO sales (
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
      ) VALUES (
        $id,
        $tenant_id,
        $cash_register_id,
        $customer_id,
        $user_id,
        $total,
        $payment_method,
        $status,
        $device_id,
        $created_at,
        $updated_at
      )`,
      {
        $id: saleId,
        $tenant_id: tenantId,
        $cash_register_id: input.cashRegisterId ?? null,
        $customer_id: input.customerId ?? null,
        $user_id: input.userId ?? null,
        $total: total,
        $payment_method: input.paymentMethod,
        $status: 'completed',
        $device_id: deviceId,
        $created_at: now,
        $updated_at: now,
      },
    );
  });

  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'sale',
    entityId: saleId,
    kind: 'create',
    payload: {
      id: saleId,
      tenant_id: tenantId,
      payment_method: input.paymentMethod,
      user_id: input.userId ?? null,
      customer_id: input.customerId ?? null,
      cash_register_id: input.cashRegisterId ?? null,
      device_id: deviceId,
      items: saleItemsPayload,
    },
  });

  return saleId;
}

export async function createDemoSale(db: SQLiteDatabase, tenantId = 'local') {
  const product = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM products WHERE tenant_id = $tenant_id AND stock > 0 ORDER BY updated_at DESC LIMIT 1`,
    { $tenant_id: tenantId },
  );

  if (!product) {
    throw new Error('No hay productos con stock para crear una venta demo.');
  }

  return createSale(db, {
    tenantId,
    paymentMethod: 'cash',
    items: [{ productId: product.id, quantity: 1 }],
  });
}
