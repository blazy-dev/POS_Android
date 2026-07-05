import type { SQLiteDatabase } from 'expo-sqlite';
import {
  apiConfig,
  checkApiHealth,
  pushSyncOperations,
  pullSyncChanges,
  addSyncLog,
  SyncOperationPayload,
  supabase,
} from '../api';
import * as FileSystem from 'expo-file-system/legacy';

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  errorMessage?: string;
}

/**
 * Decodifica una cadena Base64 a un ArrayBuffer puro de JavaScript de forma autocontenida
 * y compatible con cualquier entorno React Native (incluyendo Hermes).
 */
export function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  const cleanBase64 = base64.replace(/=+$/, '').replace(/[\r\n]/g, '');
  const len = cleanBase64.length;
  const bufferLength = Math.floor(len * 0.75);
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[cleanBase64.charCodeAt(i)];
    const encoded2 = lookup[cleanBase64.charCodeAt(i + 1)];
    const encoded3 = lookup[cleanBase64.charCodeAt(i + 2)];
    const encoded4 = lookup[cleanBase64.charCodeAt(i + 3)];
    
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }
  return arrayBuffer;
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
      console.log(`[SYNC] PUSH: ${pendingOps.length} operaciones pendientes en total`);
      
      // Separamos operaciones de base de datos (NestJS) y de archivos en la nube (Supabase Storage)
      const apiOps = pendingOps.filter(
        (op) => op.entity_type !== 'sales_archive' && op.entity_type !== 'tenant_logo_upload'
      );
      const storageOps = pendingOps.filter(
        (op) => op.entity_type === 'sales_archive' || op.entity_type === 'tenant_logo_upload'
      );

      // --- 1. Sincronizar operaciones normales de Base de Datos ---
      if (apiOps.length > 0) {
        console.log(`[SYNC] PUSH API: ${apiOps.length} operaciones a enviar`);
        const operationsToSend: SyncOperationPayload[] = apiOps.map((op) => ({
          id: op.id,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          operation: op.operation,
          payload: JSON.parse(op.payload),
        }));

        const pushRes = await pushSyncOperations(operationsToSend);
        const failedIds = pushRes.failedIds || [];

        await db.withExclusiveTransactionAsync(async (txn) => {
          for (const op of apiOps) {
            const didFail = failedIds.includes(op.id) || (!pushRes.success && failedIds.length === 0);
            if (didFail) {
              const nextRetries = op.retries + 1;
              const nextStatus = nextRetries >= 10 ? 'failed' : 'pending';
              await txn.runAsync(
                `UPDATE sync_operations 
                 SET retries = $retries, status = $status, updated_at = $now 
                 WHERE id = $id`,
                { $retries: nextRetries, $status: nextStatus, $now: now, $id: op.id }
              );
            } else {
              pushedCount++;
              await txn.runAsync(
                `UPDATE sync_operations 
                 SET status = 'synced', updated_at = $now 
                 WHERE id = $id`,
                { $now: now, $id: op.id }
              );
            }
          }
        });

        if (!pushRes.success && failedIds.length === 0) {
          console.warn('[SYNC] Error en PUSH API:', pushRes.error);
        }
      }

      // --- 2. Sincronizar archivos a Supabase Storage (Logos y CSVs de Ventas) ---
      for (const op of storageOps) {
        console.log(`[SYNC] PUSH STORAGE: Procesando ${op.entity_type} (ID: ${op.id})`);
        try {
          const payload = JSON.parse(op.payload);

          // Verificar existencia del archivo antes de subirlo
          const fileInfo = await FileSystem.getInfoAsync(payload.localFileUri);
          if (!fileInfo.exists) {
            console.warn(`[SYNC] Archivo local no existe en ruta: ${payload.localFileUri}. Marcando sync como fallido.`);
            await db.runAsync(
              `UPDATE sync_operations SET status = 'failed', updated_at = $now WHERE id = $id`,
              { $now: now, $id: op.id }
            );
            continue;
          }

          // Leer el archivo en Base64 y convertir a ArrayBuffer
          const base64Str = await FileSystem.readAsStringAsync(payload.localFileUri, { encoding: 'base64' });
          const arrayBuffer = decodeBase64ToArrayBuffer(base64Str);

          if (op.entity_type === 'sales_archive') {
            // Subir CSV consolidado mensual al bucket privado
            const { error } = await supabase.storage
              .from('tenant-sales-archives')
              .upload(`archives/${payload.tenantId}/${payload.fileName}`, arrayBuffer, {
                contentType: 'text/csv',
                upsert: true,
              });

            if (error) throw error;
          } else if (op.entity_type === 'tenant_logo_upload') {
            // Subir logo comercial al bucket público
            const { error } = await supabase.storage
              .from('tenant-logos')
              .upload(`logos/${payload.tenantId}_logo.png`, arrayBuffer, {
                contentType: 'image/png',
                upsert: true,
              });

            if (error) throw error;

            // Obtener la URL pública del logo subido
            const { data } = supabase.storage
              .from('tenant-logos')
              .getPublicUrl(`logos/${payload.tenantId}_logo.png`);

            if (data?.publicUrl) {
              const publicUrl = data.publicUrl;
              console.log(`[SYNC] Logo subido con éxito. URL Pública: ${publicUrl}`);
              // Actualizar localmente en SQLite el metadato del logo a la URL de la nube
              await db.runAsync(
                `INSERT OR REPLACE INTO app_metadata (key, value, updated_at) 
                 VALUES ($key, $value, $now)`,
                {
                  $key: `tenant_logo_${payload.tenantId}`,
                  $value: publicUrl,
                  $now: now,
                }
              );
            }
          }

          // Marcar operación de almacenamiento como sincronizada exitosamente
          pushedCount++;
          await db.runAsync(
            `UPDATE sync_operations SET status = 'synced', updated_at = $now WHERE id = $id`,
            { $now: now, $id: op.id }
          );

          // Opcional: Eliminar archivo temporal local una vez subido con éxito a la nube
          if (op.entity_type === 'sales_archive') {
            try {
              await FileSystem.deleteAsync(payload.localFileUri, { idempotent: true });
            } catch (fsErr) {
              console.warn('[SYNC] No se pudo eliminar archivo local purgado:', fsErr);
            }
          }
        } catch (err: any) {
          console.error(`[SYNC] Error al subir archivo a Supabase Storage para operacion ${op.id}:`, err);
          const nextRetries = op.retries + 1;
          const nextStatus = nextRetries >= 10 ? 'failed' : 'pending';
          await db.runAsync(
            `UPDATE sync_operations 
             SET retries = $retries, status = $status, updated_at = $now 
             WHERE id = $id`,
            { $retries: nextRetries, $status: nextStatus, $now: now, $id: op.id }
          );
        }
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
                    `INSERT INTO sale_items (id, tenant_id, sale_id, product_id, product_name, product_unit, quantity, unit_price, subtotal, created_at, updated_at)
                     VALUES ($id, $tenant_id, $sale_id, $product_id, $product_name, $product_unit, $quantity, $unit_price, $subtotal, $created_at, $updated_at)
                     ON CONFLICT(id) DO UPDATE SET
                       product_name = excluded.product_name,
                       product_unit = excluded.product_unit,
                       quantity = excluded.quantity,
                       unit_price = excluded.unit_price,
                       subtotal = excluded.subtotal,
                       updated_at = excluded.updated_at`,
                    {
                      $id: item.id,
                      $tenant_id: p.tenant_id ?? 'local',
                      $sale_id: item.sale_id ?? p.id,
                      $product_id: item.product_id || null,
                      $product_name: item.product_name || item.productName || 'Producto Sincronizado',
                      $product_unit: item.product_unit || item.productUnit || 'unit',
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
