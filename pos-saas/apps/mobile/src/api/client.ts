// Cliente de API HTTP con simulador integrado para modo Offline-First.
// En producción, esto consumirá los endpoints definidos en API_SPEC.md.

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
  error?: string;
}

export interface PullChange {
  id: string;
  entity_type: "product" | "sale" | "inventory_movement" | "cash_register";
  entity_id: string;
  operation: "create" | "update" | "delete";
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
  // 10.0.2.2 es la dirección IP especial de loopback en el Emulador de Android
  // para apuntar a 'localhost' de la máquina host de desarrollo.
  // Modificar a la IP local de tu red si estás probando con un dispositivo móvil físico.
  baseUrl: "http://10.0.2.2:8000/api/v1",
  simulateOffline: false,
  simulateServerError: false,
};

// Logs de eventos de sincronización para visualización en la UI
export type LogEvent = {
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
};

let syncLogs: LogEvent[] = [];
let onLogsChange: ((logs: LogEvent[]) => void) | null = null;

export function addSyncLog(type: "info" | "success" | "error" | "warning", message: string) {
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

// Token JWT cacheado en memoria para la sesión activa de sincronización
let cachedToken: string | null = null;

/**
 * Obtiene el token de autenticación del backend.
 * Para desarrollo, realiza un inicio de sesión automático usando el token semilla de pruebas.
 */
async function getAuthToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${apiConfig.baseUrl}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_token: "test-token",
      }),
    });

    if (!response.ok) {
      throw new Error(`Código de estado HTTP: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    return cachedToken!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    addSyncLog("error", `Fallo al autenticar en el backend: ${msg}`);
    throw new Error("Authentication failed");
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos de timeout

    const response = await fetch(`${apiConfig.baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Envía un lote de operaciones pendientes al servidor (PUSH).
 */
export async function pushSyncOperations(operations: SyncOperationPayload[]): Promise<PushResponse> {
  addSyncLog("info", `Iniciando PUSH de ${operations.length} operaciones...`);

  if (apiConfig.simulateOffline) {
    addSyncLog("error", "Error de red al intentar hacer PUSH: Sin conexión.");
    throw new Error("Network request failed");
  }

  if (apiConfig.simulateServerError) {
    addSyncLog("error", "Error 500: Fallo en el servidor durante PUSH.");
    return { success: false, processed: 0, failed: operations.length, error: "Internal Server Error" };
  }

  try {
    const token = await getAuthToken();
    const response = await fetch(`${apiConfig.baseUrl}/sync/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Device-Id": "device-expo-dev-client",
      },
      body: JSON.stringify({
        operations: operations.map(op => ({
          operation_id: op.id,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          operation: op.operation,
          payload: op.payload,
        }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      addSyncLog("error", `Fallo en PUSH (${response.status}): ${errText}`);
      return {
        success: false,
        processed: 0,
        failed: operations.length,
        error: `Server responded with ${response.status}`,
      };
    }

    const data = await response.json();
    addSyncLog("success", `PUSH completado. Procesados: ${data.processed}, Fallados: ${data.failed}`);
    
    return {
      success: data.failed === 0,
      processed: data.processed,
      failed: data.failed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    addSyncLog("error", `Error en canal PUSH: ${msg}`);
    throw err;
  }
}

/**
 * Obtiene los cambios remotos desde la fecha dada (PULL).
 */
export async function pullSyncChanges(lastSyncAt: string | null): Promise<PullResponse> {
  addSyncLog("info", "Iniciando PULL de cambios remotos...");

  if (apiConfig.simulateOffline) {
    addSyncLog("error", "Error de red al intentar hacer PULL: Sin conexión.");
    throw new Error("Network request failed");
  }

  if (apiConfig.simulateServerError) {
    addSyncLog("error", "Error 500: Fallo en el servidor durante PULL.");
    throw new Error("Server error (500)");
  }

  try {
    const token = await getAuthToken();
    let url = `${apiConfig.baseUrl}/sync/pull`;
    if (lastSyncAt) {
      url += `?last_sync_at=${encodeURIComponent(lastSyncAt)}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Device-Id": "device-expo-dev-client",
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      addSyncLog("error", `Fallo en PULL (${response.status}): ${errText}`);
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    addSyncLog("success", `PULL exitoso: ${data.changes.length} cambios recibidos.`);
    
    return {
      success: true,
      changes: data.changes,
      server_time: data.server_time,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    addSyncLog("error", `Error en canal PULL: ${msg}`);
    throw err;
  }
}

