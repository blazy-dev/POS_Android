import type { SQLiteDatabase } from 'expo-sqlite';
import {
  apiConfig,
  checkApiHealth,
  pushSyncOperations,
  pullSyncChanges,
  addSyncLog,
  SyncOperationPayload,
} from '../api';

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  errorMessage?: string;
}

/**
 * Motor de Sincronización (Push/Pull)
 * Se conecta a la base de datos local SQLite y sincroniza operaciones locales pendientes
 * con el backend, y descarga los cambios remotos.
 */
export async function runSync(db: SQLiteDatabase): Promise<SyncResult> {
  console.log('[SYNC] Iniciando sincronización...');
  console.log('[SYNC] API URL:', apiConfig.baseUrl);

  const isOnline = await checkApiHealth();
  console.log('[SYNC] Health check:', isOnline ? 'OK' : 'FAILED');

  if (!isOnline) {
    addSyncLog('warning', 'Sincronización abortada: Servidor no disponible.');
    return {
      success: false,
      pushedCount: 0,
      pulledCount: 0,
      errorMessage: 'Servidor no disponible o modo offline activo',
    };
  }

  let pushedCount = 0;
  let pulledCount = 0;

  try {
    const now = new Date().toISOString();

    // ==========================================
    // 1. FASE PUSH (Subir cambios locales)
    // ==========================================
    // Obtenemos las operaciones pendientes de sincronización
    const pendingOps = await db.getAllAsync<{
      id: string;
      entity_type: string;
      entity_id: string;
      operation: string;
      payload: string;
      retries: number;
    }>(
      `SELECT id, entity_type, entity_id, operation, payload, retries 
       FROM sync_operations 
       WHERE status = 'pending' 
       ORDER BY created_at ASC`,
    );

    if (pendingOps.length > 0) {
      console.log(`[SYNC] PUSH: ${pendingOps.length} operaciones pendientes`);
      // Mapeamos los datos al formato que espera la API
      const operationsToSend: SyncOperationPayload[] = pendingOps.map((op) => ({
        id: op.id,
        entity_type: op.entity_type,
        entity_id: op.entity_id,
        operation: op.operation,
        payload: JSON.parse(op.payload),
      }));

      // Llamamos a la API
      const pushRes = await pushSyncOperations(operationsToSend);

      const failedIds = pushRes.failedIds || [];

      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const op of pendingOps) {
          const didFail =
            failedIds.includes(op.id) ||
            (!pushRes.success && failedIds.length === 0);
          if (didFail) {
            const nextRetries = op.retries + 1;
            const nextStatus = nextRetries >= 10 ? 'failed' : 'pending';
            await txn.runAsync(
              `UPDATE sync_operations 
               SET retries = $retries, status = $status, updated_at = $now 
               WHERE id = $id`,
              {
                $retries: nextRetries,
                $status: nextStatus,
                $now: now,
                $id: op.id,
              },
            );
          } else {
            pushedCount++;
            await txn.runAsync(
              `UPDATE sync_operations 
               SET status = 'synced', updated_at = $now 
               WHERE id = $id`,
              { $now: now, $id: op.id },
            );
          }
        }
      });

      if (!pushRes.success && failedIds.length === 0) {
        throw new Error(pushRes.error ?? 'Fallo en el procesamiento de Push');
      } else if (failedIds.length > 0) {
        addSyncLog(
          'warning',
          `PUSH parcial: ${failedIds.length} de ${pendingOps.length} operaciones fallaron.`,
        );
      }
    } else {
      addSyncLog('info', 'No hay cambios locales pendientes por subir.');
    }

    // ==========================================
    // 2. FASE PULL (Bajar cambios remotos)
    // ==========================================
    // Obtenemos la última fecha de sincronización del dispositivo
    const deviceState = await db.getFirstAsync<{ last_sync_at: string | null }>(
      `SELECT last_sync_at FROM device_state WHERE id = 1`,
    );
    const lastSyncAt = deviceState?.last_sync_at ?? null;

    // Llamamos a la API
    console.log(`[SYNC] PULL: lastSyncAt=${lastSyncAt}`);
    const pullRes = await pullSyncChanges(lastSyncAt);
    console.log(`[SYNC] PULL resultado: ${pullRes.changes.length} cambios`);

    if (pullRes.success && pullRes.changes.length > 0) {
      pulledCount = pullRes.changes.length;

      // Aplicamos cambios remotos localmente dentro de una transaccion exclusiva
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const change of pullRes.changes) {
          const p = change.payload;
          const op = change.operation;

          if (change.entity_type === 'category') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO categories (id, tenant_id, name, created_at, updated_at)
                 VALUES ($id, $tenant_id, $name, $created_at, $updated_at)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $name: p.name,
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );
            } else if (op === 'delete') {
              await txn.runAsync('DELETE FROM categories WHERE id = $id', {
                $id: change.entity_id,
              });
            }
          } else if (change.entity_type === 'customer') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO customers (id, tenant_id, name, phone, email, address, created_at, updated_at)
                 VALUES ($id, $tenant_id, $name, $phone, $email, $address, $created_at, $updated_at)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   phone = excluded.phone,
                   email = excluded.email,
                   address = excluded.address,
                   updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $name: p.name,
                  $phone: p.phone ?? null,
                  $email: p.email ?? null,
                  $address: p.address ?? null,
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );
            } else if (op === 'delete') {
              await txn.runAsync('DELETE FROM customers WHERE id = $id', {
                $id: change.entity_id,
              });
            }
          } else if (change.entity_type === 'product') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO products (
                  id, tenant_id, barcode, name, category_id, purchase_price, sale_price, stock, unit, is_active, created_at, updated_at
                ) VALUES (
                  $id, $tenant_id, $barcode, $name, $category_id, $purchase_price, $sale_price, $stock, $unit, $is_active, $created_at, $updated_at
                ) ON CONFLICT(id) DO UPDATE SET
                  barcode = excluded.barcode,
                  name = excluded.name,
                  category_id = excluded.category_id,
                  purchase_price = excluded.purchase_price,
                  sale_price = excluded.sale_price,
                  stock = excluded.stock,
                  unit = excluded.unit,
                  is_active = excluded.is_active,
                  updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $barcode: p.barcode ?? null,
                  $name: p.name,
                  $category_id: p.category_id ?? null,
                  $purchase_price: p.purchase_price ?? 0,
                  $sale_price: p.sale_price ?? 0,
                  $stock: p.stock ?? 0,
                  $unit: p.unit ?? 'unit',
                  $is_active: p.is_active ?? 1,
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );
            } else if (op === 'delete') {
              await txn.runAsync(
                'UPDATE products SET is_active = 0, updated_at = $now WHERE id = $id',
                { $now: now, $id: change.entity_id },
              );
            }
          } else if (change.entity_type === 'cash_register') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO cash_registers (id, tenant_id, opened_by, opened_at, closed_at, opening_amount, closing_amount, status, created_at, updated_at)
                 VALUES ($id, $tenant_id, $opened_by, $opened_at, $closed_at, $opening_amount, $closing_amount, $status, $created_at, $updated_at)
                 ON CONFLICT(id) DO UPDATE SET
                   opened_by = excluded.opened_by,
                   closed_at = excluded.closed_at,
                   closing_amount = excluded.closing_amount,
                   status = excluded.status,
                   updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $opened_by: p.opened_by ?? '',
                  $opened_at: p.opened_at ?? now,
                  $closed_at: p.closed_at ?? null,
                  $opening_amount: p.opening_amount ?? 0,
                  $closing_amount: p.closing_amount ?? null,
                  $status: p.status ?? 'open',
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );
            } else if (op === 'delete') {
              await txn.runAsync(
                'DELETE FROM cash_registers WHERE id = $id',
                { $id: change.entity_id },
              );
            }
          } else if (change.entity_type === 'sale') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO sales (id, tenant_id, cash_register_id, customer_id, user_id, total, payment_method, status, device_id, created_at, updated_at)
                 VALUES ($id, $tenant_id, $cash_register_id, $customer_id, $user_id, $total, $payment_method, $status, $device_id, $created_at, $updated_at)
                 ON CONFLICT(id) DO UPDATE SET
                   total = excluded.total,
                   payment_method = excluded.payment_method,
                   status = excluded.status,
                   updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $cash_register_id: p.cash_register_id ?? null,
                  $customer_id: p.customer_id ?? null,
                  $user_id: p.user_id ?? null,
                  $total: p.total ?? 0,
                  $payment_method: p.payment_method ?? 'cash',
                  $status: p.status ?? 'completed',
                  $device_id: p.device_id ?? '',
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );

              // Procesar items de la venta
              if (p.items && Array.isArray(p.items)) {
                for (const item of p.items) {
                  await txn.runAsync(
                    `INSERT INTO sale_items (id, tenant_id, sale_id, product_id, quantity, unit_price, subtotal, created_at, updated_at)
                     VALUES ($id, $tenant_id, $sale_id, $product_id, $quantity, $unit_price, $subtotal, $created_at, $updated_at)
                     ON CONFLICT(id) DO UPDATE SET
                       quantity = excluded.quantity,
                       unit_price = excluded.unit_price,
                       subtotal = excluded.subtotal,
                       updated_at = excluded.updated_at`,
                    {
                      $id: item.id,
                      $tenant_id: p.tenant_id ?? 'local',
                      $sale_id: item.sale_id ?? p.id,
                      $product_id: item.product_id ?? '',
                      $quantity: Number(item.quantity) || 0,
                      $unit_price: Number(item.unit_price) || 0,
                      $subtotal: Number(item.subtotal) || 0,
                      $created_at: item.created_at ?? now,
                      $updated_at: item.updated_at ?? now,
                    },
                  );
                }
              }
            } else if (op === 'delete') {
              await txn.runAsync('DELETE FROM sales WHERE id = $id', {
                $id: change.entity_id,
              });
            }
          } else if (change.entity_type === 'inventory_movement') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO inventory_movements (id, tenant_id, product_id, user_id, reference_type, reference_id, movement_type, quantity, created_at, updated_at)
                 VALUES ($id, $tenant_id, $product_id, $user_id, $reference_type, $reference_id, $movement_type, $quantity, $created_at, $updated_at)
                 ON CONFLICT(id) DO UPDATE SET
                   movement_type = excluded.movement_type,
                   quantity = excluded.quantity,
                   reference_type = excluded.reference_type,
                   updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $product_id: p.product_id ?? '',
                  $user_id: p.user_id ?? null,
                  $reference_type: p.reference_type ?? '',
                  $reference_id: p.reference_id ?? '',
                  $movement_type: p.movement_type ?? 'in',
                  $quantity: Number(p.quantity) || 0,
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );
            } else if (op === 'delete') {
              await txn.runAsync(
                'DELETE FROM inventory_movements WHERE id = $id',
                { $id: change.entity_id },
              );
            }
          } else if (change.entity_type === 'user') {
            if (op === 'create' || op === 'update') {
              await txn.runAsync(
                `INSERT INTO users (id, tenant_id, name, email, pin, role, is_active, created_at, updated_at)
                 VALUES ($id, $tenant_id, $name, $email, $pin, $role, $is_active, $created_at, $updated_at)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   email = excluded.email,
                   pin = excluded.pin,
                   role = excluded.role,
                   is_active = excluded.is_active,
                   updated_at = excluded.updated_at`,
                {
                  $id: p.id,
                  $tenant_id: p.tenant_id ?? 'local',
                  $name: p.name,
                  $email: p.email,
                  $pin: p.pin ?? null,
                  $role: p.role ?? 'cashier',
                  $is_active: p.is_active ? 1 : 0,
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                },
              );
            } else if (op === 'delete') {
              await txn.runAsync(
                'UPDATE users SET is_active = 0, updated_at = $now WHERE id = $id',
                { $now: now, $id: change.entity_id },
              );
            }
          }
        }

        // Actualizamos la fecha de última sincronización en device_state
        await txn.runAsync(
          `UPDATE device_state 
           SET last_sync_at = $last_sync_at, updated_at = $now 
           WHERE id = 1`,
          { $last_sync_at: pullRes.server_time, $now: now },
        );
      });
    }

    addSyncLog(
      'success',
      `Sincronización finalizada. Subidos: ${pushedCount}. Descargados: ${pulledCount}.`,
    );
    return {
      success: true,
      pushedCount,
      pulledCount,
    };
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : 'Error desconocido';
    console.error('[SYNC] Error:', errMessage);
    addSyncLog('error', `Fallo en sincronización: ${errMessage}`);
    return {
      success: false,
      pushedCount,
      pulledCount,
      errorMessage: errMessage,
    };
  }
}
