// Cliente de API HTTP con simulador integrado para modo Offline-First.
// En producción, esto consumirá los endpoints definidos en API_SPEC.md.
import { supabase } from './supabase';

export interface SyncOperationPayload {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: any;
}

export interface PushResponse {
  success: boolean;
  processed: number;
  failed: number;
  failedIds?: string[];
  error?: string;
}

export interface PullChange {
  id: string;
  entity_type:
    | 'product'
    | 'category'
    | 'customer'
    | 'sale'
    | 'inventory_movement'
    | 'cash_register'
    | 'user';
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  created_at: string;
}

export interface PullResponse {
  success: boolean;
  changes: PullChange[];
  server_time: string;
}

// Configuración y variables de conexión
export const apiConfig = {
  // Usar EXPO_PUBLIC_API_URL si está definida, sino fallback a localhost:3001
  // Para emulador Android: http://10.0.2.2:3001/api/v1
  // Para dispositivo físico: http://<IP_DE_TU_PC>:3001/api/v1
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://107.170.73.166/api/v1',
  simulateOffline: false,
  simulateServerError: false,
  // Configuración de Supabase para Auth
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://dukyedgoyshhtjkuphow.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1a3llZGdvb3NoaHRqa3VwaG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTYxOTIwMDAsImV4cCI6MjAzMTc2ODAwMH0.xxxx_placeholder_key_change_me',
};

// Logs de eventos de sincronización para visualización en la UI
export type LogEvent = {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
};

let syncLogs: LogEvent[] = [];
let onLogsChange: ((logs: LogEvent[]) => void) | null = null;

export function addSyncLog(
  type: 'info' | 'success' | 'error' | 'warning',
  message: string,
) {
  const event: LogEvent = {
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
  };
  syncLogs = [event, ...syncLogs].slice(0, 50); // Mantenemos los últimos 50 logs
  if (onLogsChange) {
    onLogsChange(syncLogs);
  }
}

export function getSyncLogs() {
  return syncLogs;
}

export function subscribeToLogs(callback: (logs: LogEvent[]) => void) {
  onLogsChange = callback;
  callback(syncLogs);
  return () => {
    onLogsChange = null;
  };
}

export function clearSyncLogs() {
  syncLogs = [];
  if (onLogsChange) onLogsChange([]);
}
// Token JWT cacheado en memoria para la sesion activa de sincronizacion
let cachedToken: string | null = null;

export function setCachedToken(token: string | null) {
  cachedToken = token;
}

export function getCachedToken(): string | null {
  return cachedToken;
}

async function getAuthToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) {
      return 'test-token';
    }
    return session.access_token;
  } catch (err) {
    return 'test-token';
  }
}

/**
 * Realiza un chequeo rápido de conectividad (Health Check).
 */
export async function checkApiHealth(): Promise<boolean> {
  if (apiConfig.simulateOffline) {
    return false;
  }

  if (apiConfig.simulateServerError) {
    return false;
  }

  try {
    console.log('[API] Health check:', `${apiConfig.baseUrl}/health`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${apiConfig.baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('[API] Health check response:', response.status);
    return response.ok;
  } catch (err) {
    console.error('[API] Health check error:', err);
    return false;
  }
}

/**
 * Envía un lote de operaciones pendientes al servidor (PUSH).
 */
export async function pushSyncOperations(
  operations: SyncOperationPayload[],
): Promise<PushResponse> {
  addSyncLog('info', `Iniciando PUSH de ${operations.length} operaciones...`);

  if (apiConfig.simulateOffline) {
    addSyncLog('error', 'Error de red al intentar hacer PUSH: Sin conexión.');
    throw new Error('Network request failed');
  }

  if (apiConfig.simulateServerError) {
    addSyncLog('error', 'Error 500: Fallo en el servidor durante PUSH.');
    return {
      success: false,
      processed: 0,
      failed: operations.length,
      error: 'Internal Server Error',
    };
  }

  try {
    const token = await getAuthToken();
    console.log(
      '[API] PUSH:',
      `${apiConfig.baseUrl}/sync/push`,
      `ops: ${operations.length}`,
    );
    const response = await fetch(`${apiConfig.baseUrl}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Device-Id': 'device-expo-dev-client',
      },
      body: JSON.stringify({
        operations: operations.map((op) => ({
          operation_id: op.id,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          operation: op.operation,
          payload: op.payload,
        })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      addSyncLog('error', `Fallo en PUSH (${response.status}): ${errText}`);
      return {
        success: false,
        processed: 0,
        failed: operations.length,
        error: `Server responded with ${response.status}`,
      };
    }

    const data = await response.json();
    addSyncLog(
      'success',
      `PUSH completado. Procesados: ${data.processed}, Fallados: ${data.failed}`,
    );

    return {
      success: data.failed === 0,
      processed: data.processed,
      failed: data.failed,
      failedIds: data.failedIds,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    addSyncLog('error', `Error en canal PUSH: ${msg}`);
    throw err;
  }
}

/**
 * Obtiene los cambios remotos desde la fecha dada (PULL).
 */
export async function pullSyncChanges(
  lastSyncAt: string | null,
): Promise<PullResponse> {
  addSyncLog('info', 'Iniciando PULL de cambios remotos...');

  if (apiConfig.simulateOffline) {
    addSyncLog('error', 'Error de red al intentar hacer PULL: Sin conexión.');
    throw new Error('Network request failed');
  }

  if (apiConfig.simulateServerError) {
    addSyncLog('error', 'Error 500: Fallo en el servidor durante PULL.');
    throw new Error('Server error (500)');
  }

  try {
    const token = await getAuthToken();
    let url = `${apiConfig.baseUrl}/sync/pull`;
    if (lastSyncAt) {
      url += `?last_sync_at=${encodeURIComponent(lastSyncAt)}`;
    }
    console.log('[API] PULL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Device-Id': 'device-expo-dev-client',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      addSyncLog('error', `Fallo en PULL (${response.status}): ${errText}`);
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    addSyncLog(
      'success',
      `PULL exitoso: ${data.changes.length} cambios recibidos.`,
    );

    return {
      success: true,
      changes: data.changes,
      server_time: data.server_time,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    addSyncLog('error', `Error en canal PULL: ${msg}`);
    throw err;
  }
}
