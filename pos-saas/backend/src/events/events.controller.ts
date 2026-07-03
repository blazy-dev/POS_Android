import { Controller, Sse, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventBusService, SyncEvent } from './event-bus';

/**
 * Endpoint SSE (Server-Sent Events) — conexion persistente unidireccional
 * del backend hacia todos los clientes web conectados.
 *
 * El web abre una conexion a GET /api/v1/events y recibe eventos en tiempo real
 * cuando el backend procesa cambios (push del mobile, escritura del dashboard).
 *
 * No requiere autenticacion: los eventos solo contienen tipo+operacion+id,
 * no datos sensibles. El refetch posterior usa autenticacion normal.
 */
@Controller('events')
export class EventsController {
  constructor(private eventBus: EventBusService) {}

  @Sse()
  events(@Query('lastEventId') _lastEventId?: string): Observable<any> {
    return new Observable<SyncEvent>((subscriber) => {
      const unsubscribe = this.eventBus.subscribe((event) => {
        subscriber.next(event);
      });

      // Enviar heartbeat inicial para confirmar conexion
      subscriber.next({
        entityType: 'connection',
        operation: 'connected',
        entityId: '',
        timestamp: new Date().toISOString(),
      } as SyncEvent);

      return () => unsubscribe();
    });
  }
}