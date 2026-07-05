import type { SQLiteDatabase } from 'expo-sqlite';
import {
  enqueueSyncOperation,
  listRecentSales as listRecentSalesQuery,
  getAppMeta,
  setAppMeta,
} from '../../database';
import { createLocalId } from '../../utils/ids';
import { findProductByBarcode } from '../products';
import * as FileSystem from 'expo-file-system/legacy';

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
  let total = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
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
      total: total,
      created_at: now,
      updated_at: now,
      items: saleItemsPayload,
    },
  });

  // Ejecutar el proceso de purgado y archivado en segundo plano
  void pruneAndArchiveSales(db, tenantId);

  return saleId;
}

export async function pruneAndArchiveSales(db: SQLiteDatabase, tenantId: string) {
  try {
    // 1. Obtener estado de suscripción del tenant
    const statusMeta = await getAppMeta<string>(db, `tenant_subscription_status_${tenantId}`);
    const isPremium = statusMeta === 'active';

    if (isPremium) {
      // --- CASO PREMIUM: Retención de 90 días con archivado a CSV ---
      const cutoffTime = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffTime).toISOString();

      // Buscar si existen ventas con antigüedad > 90 días
      const oldSales = await db.getAllAsync<{ id: string; created_at: string; total: number; payment_method: string }>(
        `SELECT id, created_at, total, payment_method FROM sales WHERE tenant_id = $tenant_id AND created_at < $cutoff`,
        { $tenant_id: tenantId, $cutoff: cutoffIso }
      );

      if (oldSales.length > 0) {
        // Consultar el detalle de los ítems de estas ventas para consolidar un CSV completo
        const saleIds = oldSales.map(s => `'${s.id}'`).join(',');
        const oldItems = await db.getAllAsync<{ sale_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }>(
          `SELECT sale_id, product_name, quantity, unit_price, subtotal FROM sale_items WHERE sale_id IN (${saleIds})`
        );

        // Agrupar ventas antiguas por Año y Mes
        const salesByMonth: Record<string, typeof oldSales> = {};
        oldSales.forEach((sale) => {
          const date = new Date(sale.created_at);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const key = `${year}_${month}`;
          if (!salesByMonth[key]) salesByMonth[key] = [];
          salesByMonth[key].push(sale);
        });

        // Generar un archivo CSV por cada mes y subirlo
        for (const [monthKey, monthSales] of Object.entries(salesByMonth)) {
          let csvContent = 'ID Venta,Fecha,Metodo Pago,Total Venta,Producto,Cantidad,Precio Unitario,Subtotal\n';
          
          monthSales.forEach((sale) => {
            const items = oldItems.filter(item => item.sale_id === sale.id);
            if (items.length > 0) {
              items.forEach((item) => {
                csvContent += `"${sale.id}","${sale.created_at}","${sale.payment_method}",${sale.total},"${item.product_name.replace(/"/g, '""')}",${item.quantity},${item.unit_price},${item.subtotal}\n`;
              });
            } else {
              csvContent += `"${sale.id}","${sale.created_at}","${sale.payment_method}",${sale.total},"Sin items",0,0,0\n`;
            }
          });

          // Guardar archivo CSV local
          const folderUri = `${FileSystem.documentDirectory}archivos_ventas`;
          const fileUri = `${folderUri}/sales_${monthKey}.csv`;

          const dirInfo = await FileSystem.getInfoAsync(folderUri);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
          }

          await FileSystem.writeAsStringAsync(fileUri, csvContent);

          // Encolar la subida del CSV a Supabase Storage (offline-first sync operation)
          // La operación de sync se encargará de subir el archivo al bucket 'tenant-sales-archives'
          const syncId = createLocalId('sync');
          await enqueueSyncOperation(db, {
            id: syncId,
            entityType: 'sales_archive',
            entityId: monthKey,
            kind: 'create',
            payload: {
              tenantId,
              monthKey,
              localFileUri: fileUri,
              fileName: `sales_${monthKey}.csv`,
            },
          });
        }

        // Purgar de SQLite las ventas y detalles viejos
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync(
            `DELETE FROM sale_items WHERE tenant_id = $tenant_id AND sale_id IN (SELECT id FROM sales WHERE created_at < $cutoff)`,
            { $tenant_id: tenantId, $cutoff: cutoffIso }
          );
          await txn.runAsync(
            `DELETE FROM sales WHERE tenant_id = $tenant_id AND created_at < $cutoff`,
            { $tenant_id: tenantId, $cutoff: cutoffIso }
          );
        });

        console.log(`[PURGE] Purgadas ${oldSales.length} ventas antiguas en cuenta Premium.`);
      }
    } else {
      // --- CASO DEMO / EXPIRADO: Preservar datos locales ---
      // No eliminamos físicamente las ventas del dispositivo. El historial se limitará visualmente en la UI.
      console.log(`[PURGE] Licencia Demo/Inactiva. Se omitió la depuración física para proteger los datos históricos del comercio.`);
    }
  } catch (err) {
    console.error('[PURGE] Error durante purga/archivado de ventas:', err);
  }
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
