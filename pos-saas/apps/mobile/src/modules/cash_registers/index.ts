import type { SQLiteDatabase } from 'expo-sqlite';
import { enqueueSyncOperation } from '../../database';
import { createLocalId } from '../../utils/ids';

export interface CashRegisterRecord {
  id: string;
  tenant_id: string;
  opened_by: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: 'open' | 'closed';
}

/**
 * Busca si existe una sesión de caja activa (abierta) localmente.
 *
 * @param db Instancia de SQLiteDatabase
 * @param tenantId ID de la empresa (multi-tenant)
 */
export async function getActiveSession(
  db: SQLiteDatabase,
  tenantId = 'local',
): Promise<CashRegisterRecord | null> {
  return db.getFirstAsync<CashRegisterRecord>(
    `SELECT id, tenant_id, opened_by, opened_at, closed_at, opening_amount, closing_amount, status
     FROM cash_registers
     WHERE tenant_id = $tenantId AND status = 'open'`,
    { $tenantId: tenantId },
  );
}

/**
 * Registra la apertura de una nueva sesión de caja.
 *
 * @param db Instancia de SQLiteDatabase
 * @param userId UUID del usuario que abre la caja
 * @param openingAmount Monto inicial en efectivo
 * @param tenantId ID de la empresa (multi-tenant)
 */
export async function openRegister(
  db: SQLiteDatabase,
  userId: string,
  openingAmount: number,
  tenantId = 'local',
): Promise<string> {
  const sessionId = createLocalId('session');
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO cash_registers (
      id,
      tenant_id,
      opened_by,
      opened_at,
      closed_at,
      opening_amount,
      closing_amount,
      status,
      created_at,
      updated_at
    ) VALUES (
      $id,
      $tenantId,
      $userId,
      $now,
      NULL,
      $openingAmount,
      NULL,
      'open',
      $now,
      $now
    )`,
    {
      $id: sessionId,
      $tenantId: tenantId,
      $userId: userId,
      $now: now,
      $openingAmount: openingAmount,
    },
  );

  // Registrar la operación en la cola de sincronización
  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'cash_register',
    entityId: sessionId,
    kind: 'create',
    payload: {
      id: sessionId,
      tenant_id: tenantId,
      opened_by: userId,
      opened_at: now,
      opening_amount: openingAmount,
      status: 'open',
    },
  });

  return sessionId;
}

/**
 * Cierra una sesión de caja activa.
 *
 * @param db Instancia de SQLiteDatabase
 * @param sessionId UUID de la sesión de caja a cerrar
 * @param closingAmount Monto de dinero real al arqueo de cierre
 * @param tenantId ID de la empresa (multi-tenant)
 */
export async function closeRegister(
  db: SQLiteDatabase,
  sessionId: string,
  closingAmount: number,
  tenantId = 'local',
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE cash_registers
     SET closed_at = $now,
         closing_amount = $closingAmount,
         status = 'closed',
         updated_at = $now
     WHERE id = $id AND tenant_id = $tenantId`,
    {
      $id: sessionId,
      $tenantId: tenantId,
      $closingAmount: closingAmount,
      $now: now,
    },
  );

  // Registrar la operación de actualización en la cola de sincronización
  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'cash_register',
    entityId: sessionId,
    kind: 'update',
    payload: {
      id: sessionId,
      tenant_id: tenantId,
      closed_at: now,
      closing_amount: closingAmount,
      status: 'closed',
    },
  });
}

/**
 * Calcula la suma total de las ventas realizadas en efectivo durante la sesión actual de caja.
 * Esto ayuda a determinar el arqueo teórico de dinero esperado.
 *
 * @param db Instancia de SQLiteDatabase
 * @param sessionId UUID de la sesión de caja
 * @param tenantId ID de la empresa (multi-tenant)
 */
export async function getCashSalesSum(
  db: SQLiteDatabase,
  sessionId: string,
  tenantId = 'local',
): Promise<number> {
  const row = await db.getFirstAsync<{ sum: number }>(
    `SELECT SUM(total) as sum
     FROM sales
     WHERE tenant_id = $tenantId 
       AND cash_register_id = $sessionId 
       AND payment_method = 'cash' 
       AND status = 'completed'`,
    {
      $tenantId: tenantId,
      $sessionId: sessionId,
    },
  );

  return row?.sum ?? 0;
}
