import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { apiConfig } from '../api';
import { runSync } from '../sync';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

interface SyncContextType {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: string | null;
  isOfflineMode: boolean;
  isServerErrorMode: boolean;
  triggerSync: () => Promise<void>;
  setOfflineMode: (val: boolean) => void;
  setServerErrorMode: (val: boolean) => void;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(apiConfig.simulateOffline);
  const [isServerErrorMode, setIsServerErrorMode] = useState(
    apiConfig.simulateServerError,
  );

  // Consulta la cantidad de operaciones locales en cola ('pending')
  const refreshPendingCount = useCallback(async () => {
    try {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM sync_operations WHERE status = 'pending'`,
      );
      setPendingCount(row?.count ?? 0);
    } catch (err) {
      console.error('Error al obtener la cantidad de pendientes:', err);
    }
  }, [db]);

  // Consulta la fecha del último sync desde la base de datos
  const refreshLastSyncTime = useCallback(async () => {
    try {
      const row = await db.getFirstAsync<{ last_sync_at: string | null }>(
        `SELECT last_sync_at FROM device_state WHERE id = 1`,
      );
      setLastSyncAt(row?.last_sync_at ?? null);
    } catch (err) {
      console.error('Error al obtener la fecha del último sync:', err);
    }
  }, [db]);

  // Ejecuta la sincronización
  const triggerSync = useCallback(async () => {
    if (apiConfig.simulateOffline) {
      setStatus('offline');
      return;
    }

    setStatus('syncing');
    const result = await runSync(db);

    await refreshPendingCount();
    await refreshLastSyncTime();

    if (result.success) {
      setStatus('synced');
    } else {
      setStatus('error');
    }
  }, [db, refreshPendingCount, refreshLastSyncTime]);

  // Cambia el modo offline simulado
  const setOfflineMode = useCallback(
    (val: boolean) => {
      apiConfig.simulateOffline = val;
      setIsOfflineMode(val);
      if (val) {
        setStatus('offline');
      } else {
        // Al recuperar conexión, reevalúa e intenta sincronizar de inmediato
        setStatus('synced');
        void triggerSync();
      }
    },
    [triggerSync],
  );

  // Cambia el modo error de servidor simulado
  const setServerErrorMode = useCallback(
    (val: boolean) => {
      apiConfig.simulateServerError = val;
      setIsServerErrorMode(val);
      if (val) {
        setStatus('error');
      } else {
        setStatus('synced');
        void triggerSync();
      }
    },
    [triggerSync],
  );

  // Inicializacion: sync al arranque siempre (pull de cambios web + push pendientes)
  useEffect(() => {
    const initSync = async () => {
      await refreshPendingCount();
      await refreshLastSyncTime();
      void triggerSync();
    };
    void initSync();
  }, [db, triggerSync, refreshPendingCount, refreshLastSyncTime]);

  // Polling de 5 segundos para mantener actualizado el contador de pendientes
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshPendingCount();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshPendingCount]);

  // Polling de 60 segundos para auto-sincronizar: siempre pull + push si hay pendientes
  useEffect(() => {
    const timer = setInterval(() => {
      if (!apiConfig.simulateOffline) {
        void triggerSync();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [triggerSync]);

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount,
        lastSyncAt,
        isOfflineMode,
        isServerErrorMode,
        triggerSync,
        setOfflineMode,
        setServerErrorMode,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync debe ser utilizado dentro de un SyncProvider');
  }
  return context;
}
