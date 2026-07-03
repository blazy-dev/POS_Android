'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '@/lib/api';

type SyncStatus = 'synced' | 'syncing' | 'offline' | 'updates';

const ENTITY_TO_QUERY_KEY: Record<string, string[]> = {
  product: ['products'],
  user: ['employees'],
  category: ['categories'],
  customer: ['customers'],
  sale: ['sales'],
  cash_register: ['cashRegisters'],
  inventory_movement: ['inventoryMovements'],
};

export function SyncIndicator() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [autoSync, setAutoSync] = useState(true);
  const [eventCount, setEventCount] = useState(0);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Invalidate all queries and refetch ──────────────────────────
  const triggerSync = useCallback(async () => {
    setStatus('syncing');
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
    setStatus('synced');
  }, [queryClient]);

  // ── SSE connection lifecycle ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (sseRef.current) sseRef.current.close();

      const es = new EventSource(`${API_BASE}/events`);
      sseRef.current = es;

      es.onopen = () => {
        if (!cancelled) setStatus('synced');
      };

      es.onmessage = (event) => {
        if (cancelled) return;
        let entityType: string | undefined;
        try {
          entityType = JSON.parse(event.data).entityType;
        } catch {
          return;
        }
        if (!entityType) return;

        setEventCount((c) => c + 1);
        setStatus('updates');

        const keys = ENTITY_TO_QUERY_KEY[entityType];
        if (keys) {
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        } else {
          queryClient.invalidateQueries();
        }

        setTimeout(() => {
          if (!cancelled) setStatus('synced');
        }, 2000);
      };

      es.onerror = () => {
        if (cancelled) return;
        setStatus('offline');
        es.close();
        sseRef.current = null;

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!cancelled) connect();
        }, 5000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (sseRef.current) sseRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [queryClient]);

  // ── Fallback health check when auto-sync is off ────────────────
  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      const online = sseRef.current?.readyState === EventSource.OPEN;
      if (!online) setStatus('offline');
    }, 30000);

    return () => clearInterval(interval);
  }, [autoSync]);

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
                : `${eventCount > 0 ? eventCount + ' ' : ''}Actualizado`}
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
