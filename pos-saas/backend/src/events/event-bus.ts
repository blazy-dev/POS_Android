import { Injectable, Logger } from '@nestjs/common';

export interface SyncEvent {
  entityType: string;
  operation: 'create' | 'update' | 'delete' | 'connected';
  entityId: string;
  tenantId?: string;
  timestamp: string;
}

/**
 * Bus de eventos en memoria — el corazon de la sincronizacion en tiempo real.
 *
 * Cuando el backend procesa un cambio (push del mobile o escritura directa del web),
 * emite un evento aca. El SSE endpoint (EventsController) escucha y reenvia
 * a todos los clientes web conectados via Server-Sent Events.
 *
 * Flujo:
 *   Mobile elimina empleado -> POST /sync/push -> SyncService emite 'sync:change'
 *   -> EventBus -> EventsController SSE -> Web recibe evento
 *   -> invalida query 'employees' -> React Query refetch -> empleado desaparece
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private subscribers: ((event: SyncEvent) => void)[] = [];

  subscribe(callback: (event: SyncEvent) => void): () => void {
    this.subscribers.push(callback);
    this.logger.log(`SSE subscriber conectado (total: ${this.subscribers.length})`);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
      this.logger.log(`SSE subscriber desconectado (total: ${this.subscribers.length})`);
    };
  }

  emit(event: SyncEvent): void {
    this.logger.log(
      `Evento emitido: ${event.operation} ${event.entityType} (${event.entityId})`,
    );
    for (const cb of this.subscribers) {
      try {
        cb(event);
      } catch (err) {
        this.logger.error(`Error enviando evento a subscriber: ${err.message}`);
      }
    }
  }
}