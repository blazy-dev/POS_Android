import { Module } from '@nestjs/common';
import { EventBusService } from './event-bus';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}