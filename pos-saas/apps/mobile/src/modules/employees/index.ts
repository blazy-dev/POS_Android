import type { SQLiteDatabase } from 'expo-sqlite';
import { enqueueSyncOperation, getAppMeta, getEmployeesCount } from '../../database';
import type { UserRecord } from '../../database/types';
import { createLocalId } from '../../utils/ids';

export interface EmployeeInput {
  name: string;
  email: string;
  pin: string | null;
  role: string;
  tenantId?: string;
}

/**
 * Obtiene todos los empleados activos (is_active = 1) para un tenant específico.
 */
export async function listEmployees(
  db: SQLiteDatabase,
  tenantId = 'local',
): Promise<UserRecord[]> {
  return db.getAllAsync<UserRecord>(
    `SELECT id, tenant_id, name, email, pin, role, is_active, created_at, updated_at
     FROM users
     WHERE (tenant_id = $tenantId OR tenant_id = 'local')
       AND is_active = 1
     ORDER BY name ASC`,
    { $tenantId: tenantId },
  );
}

/**
 * Verifica si un PIN numérico ya está asignado a otro usuario activo dentro de la misma empresa.
 * Esto evita colisiones al iniciar sesión desde el teclado PIN.
 */
export async function isPinTaken(
  db: SQLiteDatabase,
  pin: string,
  tenantId = 'local',
  excludeUserId?: string,
): Promise<boolean> {
  if (!pin) return false;

  let query = `SELECT id FROM users WHERE tenant_id = $tenantId AND pin = $pin AND is_active = 1`;
  const params: Record<string, string> = { $tenantId: tenantId, $pin: pin };

  if (excludeUserId) {
    query += ` AND id != $excludeUserId`;
    params.$excludeUserId = excludeUserId;
  }

  const row = await db.getFirstAsync<{ id: string }>(query, params);
  return !!row;
}

/**
 * Verifica si un email ya esta registrado en el tenant local.
 */
export async function isEmailTaken(
  db: SQLiteDatabase,
  email: string,
  tenantId = 'local',
  excludeUserId?: string,
): Promise<boolean> {
  if (!email) return false;
  let query = `SELECT id FROM users WHERE tenant_id = $tenantId AND email = $email AND is_active = 1`;
  const params: Record<string, string> = { $tenantId: tenantId, $email: email };
  if (excludeUserId) {
    query += ` AND id != $excludeUserId`;
    params.$excludeUserId = excludeUserId;
  }
  const row = await db.getFirstAsync<{ id: string }>(query, params);
  return !!row;
}

/**
 * Registra o edita un empleado en la base de datos SQLite local y encola una operacion de sincronizacion.
 * Si se proporciona un user id, se actualiza el registro; de lo contrario se inserta uno nuevo.
 */
export async function saveEmployee(
  db: SQLiteDatabase,
  input: EmployeeInput,
  employeeId?: string,
): Promise<string> {
  const now = new Date().toISOString();
  const tenantId = input.tenantId ?? 'local';

  // Validar límite de la versión Demo (máx. 2 empleados activos)
  if (!employeeId) {
    const statusMeta = await getAppMeta<string>(db, `tenant_subscription_status_${tenantId}`);
    if (statusMeta !== 'active') {
      const count = await getEmployeesCount(db, tenantId);
      if (count >= 2) {
        throw new Error('Límite de la versión Demo alcanzado: no puedes crear más de 2 empleados. Activa la versión completa para gestionar personal de forma ilimitada.');
      }
    }
  }

  const id = employeeId ?? createLocalId('user');

  if (input.pin && (await isPinTaken(db, input.pin, tenantId, employeeId))) {
    throw new Error('El PIN ya está en uso por otro empleado.');
  }

  if (employeeId) {
    // Actualizar usuario existente
    // Nota: no filtrar por tenant_id en el WHERE, igual que deleteEmployee
    await db.runAsync(
      `UPDATE users
       SET name = $name,
           email = $email,
           pin = $pin,
           role = $role,
           tenant_id = $tenantId,
           updated_at = $updated_at
       WHERE id = $id`,
      {
        $id: id,
        $tenantId: tenantId,
        $name: input.name,
        $email: input.email,
        $pin: input.pin,
        $role: input.role,
        $updated_at: now,
      },
    );

    // Encolar sync update
    await enqueueSyncOperation(db, {
      id: createLocalId('sync'),
      entityType: 'user',
      entityId: id,
      kind: 'update',
      payload: {
        id,
        tenant_id: tenantId,
        name: input.name,
        email: input.email,
        pin: input.pin,
        role: input.role,
        is_active: 1,
        updated_at: now,
      },
    });
  } else {
    // Insertar nuevo usuario
    await db.runAsync(
      `INSERT INTO users (
        id,
        tenant_id,
        name,
        email,
        pin,
        role,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        $id,
        $tenantId,
        $name,
        $email,
        $pin,
        $role,
        1,
        $created_at,
        $updated_at
      )`,
      {
        $id: id,
        $tenantId: tenantId,
        $name: input.name,
        $email: input.email,
        $pin: input.pin,
        $role: input.role,
        $created_at: now,
        $updated_at: now,
      },
    );

    // Encolar sync create
    await enqueueSyncOperation(db, {
      id: createLocalId('sync'),
      entityType: 'user',
      entityId: id,
      kind: 'create',
      payload: {
        id,
        tenant_id: tenantId,
        name: input.name,
        email: input.email,
        pin: input.pin,
        role: input.role,
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
    });
  }

  return id;
}

/**
 * Desactiva un empleado en la base de datos SQLite (eliminación lógica/is_active = 0)
 * y encola una operación de sincronización de eliminación.
 */
export async function deleteEmployee(
  db: SQLiteDatabase,
  employeeId: string,
  tenantId = 'local',
): Promise<void> {
  const now = new Date().toISOString();

  const ownerEmail = await getAppMeta<string>(
    db,
    `tenant_owner_email_${tenantId}`,
  );
  const target = await db.getFirstAsync<{ email: string }>(
    `SELECT email FROM users WHERE id = $id`,
    { $id: employeeId },
  );

  if (ownerEmail && target?.email === ownerEmail) {
    throw new Error('No se puede dar de baja al usuario principal del comercio.');
  }

  // Nota: no filtrar por tenant_id aqui. El listado muestra empleados
  // de AMBOS tenants (real + 'local') pero el WHERE con tenant_id
  // fallaria si el empleado tiene tenant_id='local' y tenantId es el real.
  await db.runAsync(
    `UPDATE users
     SET is_active = 0,
         updated_at = $updated_at
     WHERE id = $id`,
    {
      $id: employeeId,
      $updated_at: now,
    },
  );

  // Registrar sync delete
  await enqueueSyncOperation(db, {
    id: createLocalId('sync'),
    entityType: 'user',
    entityId: employeeId,
    kind: 'delete',
    payload: {
      id: employeeId,
      tenant_id: tenantId,
    },
  });
}
