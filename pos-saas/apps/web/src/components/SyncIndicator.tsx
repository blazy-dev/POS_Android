'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

type SyncStatus = 'synced' | 'syncing' | 'offline' | 'updates';

export function SyncIndicator() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [autoSync, setAutoSync] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invalidate all queries and refetch
  const triggerSync = useCallback(async () => {
    setStatus('syncing');
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
    setStatus('synced');
  }, [queryClient]);

  // Check if backend is reachable
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/health`,
      );
      if (!res.ok) throw new Error();
      return true;
    } catch {
      return false;
    }
  }, []);

  // Auto-sync every 30s
  useEffect(() => {
    if (!autoSync) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tick = async () => {
      const online = await checkHealth();
      if (!online) {
        setStatus('offline');
        return;
      }
      setStatus('updates');
      setTimeout(() => setStatus('synced'), 2000);
    };

    intervalRef.current = setInterval(tick, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSync, checkHealth]);

  // Health check on mount
  useEffect(() => {
    checkHealth().then((online) => {
      if (!online) setStatus('offline');
    });
  }, [checkHealth]);

  return (
    <div className="flex items-center space-x-3">
      {/* Auto-sync toggle */}
      <button
        onClick={() => setAutoSync(!autoSync)}
        title={autoSync ? 'Auto-sync activado' : 'Auto-sync desactivado'}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
          autoSync ? 'bg-indigo-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            autoSync ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>

      {/* Status icon */}
      <div
        className={`flex items-center space-x-1.5 text-xs font-semibold ${
          status === 'synced'
            ? 'text-emerald-400'
            : status === 'syncing'
              ? 'text-indigo-400'
              : status === 'offline'
                ? 'text-rose-400'
                : 'text-amber-400'
        }`}
      >
        {status === 'synced' && <CheckCircle2 className="h-3.5 w-3.5" />}
        {status === 'syncing' && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        )}
        {status === 'offline' && <WifiOff className="h-3.5 w-3.5" />}
        {status === 'updates' && <AlertCircle className="h-3.5 w-3.5" />}
        <span>
          {status === 'synced'
            ? 'Sincronizado'
            : status === 'syncing'
              ? 'Sincronizando...'
              : status === 'offline'
                ? 'Sin conexion'
                : 'Actualizado'}
        </span>
      </div>

      {/* Sync button */}
      <button
        onClick={triggerSync}
        disabled={status === 'syncing'}
        title="Forzar sincronizacion"
        className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all duration-200 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  );
}
