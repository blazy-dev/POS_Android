import type { SQLiteDatabase } from "expo-sqlite";
import {
  checkApiHealth,
  pushSyncOperations,
  pullSyncChanges,
  addSyncLog,
  SyncOperationPayload,
} from "../api";

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
  const isOnline = await checkApiHealth();
  if (!isOnline) {
    addSyncLog("warning", "Sincronización abortada: Servidor no disponible.");
    return {
      success: false,
      pushedCount: 0,
      pulledCount: 0,
      errorMessage: "Servidor no disponible o modo offline activo",
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
       ORDER BY created_at ASC`
    );

    if (pendingOps.length > 0) {
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

      if (pushRes.success) {
        pushedCount = pushRes.processed;
        // Marcamos las operaciones como completadas ('synced') en SQLite
        await db.withExclusiveTransactionAsync(async (txn) => {
          for (const op of pendingOps) {
            await txn.runAsync(
              `UPDATE sync_operations 
               SET status = 'synced', updated_at = $now 
               WHERE id = $id`,
              { $now: now, $id: op.id }
            );
          }
        });
      } else {
        // En caso de fallo parcial/servidor, incrementamos el contador de reintentos
        await db.withExclusiveTransactionAsync(async (txn) => {
          for (const op of pendingOps) {
            const nextRetries = op.retries + 1;
            const nextStatus = nextRetries >= 10 ? "failed" : "pending";
            await txn.runAsync(
              `UPDATE sync_operations 
               SET retries = $retries, status = $status, updated_at = $now 
               WHERE id = $id`,
              {
                $retries: nextRetries,
                $status: nextStatus,
                $now: now,
                $id: op.id,
              }
            );
          }
        });
        throw new Error(pushRes.error ?? "Fallo en el procesamiento de Push");
      }
    } else {
      addSyncLog("info", "No hay cambios locales pendientes por subir.");
    }

    // ==========================================
    // 2. FASE PULL (Bajar cambios remotos)
    // ==========================================
    // Obtenemos la última fecha de sincronización del dispositivo
    const deviceState = await db.getFirstAsync<{ last_sync_at: string | null }>(
      `SELECT last_sync_at FROM device_state WHERE id = 1`
    );
    const lastSyncAt = deviceState?.last_sync_at ?? null;

    // Llamamos a la API
    const pullRes = await pullSyncChanges(lastSyncAt);

    if (pullRes.success && pullRes.changes.length > 0) {
      pulledCount = pullRes.changes.length;

      // Aplicamos cambios remotos localmente dentro de una transacción exclusiva
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const change of pullRes.changes) {
          if (change.entity_type === "product") {
            const p = change.payload;
            
            if (change.operation === "create" || change.operation === "update") {
              // Hacemos UPSERT del producto en la base de datos local
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
                  $tenant_id: p.tenant_id ?? "local",
                  $barcode: p.barcode ?? null,
                  $name: p.name,
                  $category_id: p.category_id ?? null,
                  $purchase_price: p.purchase_price ?? 0,
                  $sale_price: p.sale_price ?? 0,
                  $stock: p.stock ?? 0,
                  $unit: p.unit ?? "unit",
                  $is_active: p.is_active ?? 1,
                  $created_at: p.created_at ?? now,
                  $updated_at: p.updated_at ?? now,
                }
              );
            } else if (change.operation === "delete") {
              // Eliminación lógica local del producto
              await txn.runAsync(
                `UPDATE products 
                 SET is_active = 0, updated_at = $now 
                 WHERE id = $id`,
                { $now: now, $id: change.entity_id }
              );
            }
          }
          // Nota: Aquí se pueden agregar otros tipos de entidades remotas si el backend las soportara.
        }

        // Actualizamos la fecha de última sincronización en device_state
        await txn.runAsync(
          `UPDATE device_state 
           SET last_sync_at = $last_sync_at, updated_at = $now 
           WHERE id = 1`,
          { $last_sync_at: pullRes.server_time, $now: now }
        );
      });
    }

    addSyncLog("success", `Sincronización finalizada. Subidos: ${pushedCount}. Descargados: ${pulledCount}.`);
    return {
      success: true,
      pushedCount,
      pulledCount,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Error desconocido";
    addSyncLog("error", `Fallo en sincronización: ${errMessage}`);
    return {
      success: false,
      pushedCount,
      pulledCount,
      errorMessage: errMessage,
    };
  }
}
