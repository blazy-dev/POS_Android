import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/user.decorator';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(SupabaseAuthGuard)
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('push')
  async push(
    @CurrentUser() user: any,
    @Headers('x-device-id') deviceId: string,
    @Body() body: { operations: any[] },
  ) {
    const finalDeviceId = deviceId || 'unknown-device';
    const result = await this.syncService.pushOperations(
      user.tenantId,
      finalDeviceId,
      body.operations || [],
    );
    return {
      success: result.failed === 0,
      processed: result.processed,
      failed: result.failed,
      failedIds: result.failedIds,
    };
  }

  @Get('pull')
  async pull(
    @CurrentUser() user: any,
    @Headers('x-device-id') deviceId: string,
    @Query('last_sync_at') lastSyncAt?: string,
  ) {
    const finalDeviceId = deviceId || 'unknown-device';
    const result = await this.syncService.pullChanges(
      user.tenantId,
      finalDeviceId,
      lastSyncAt || null,
    );
    return {
      success: true,
      changes: result.changes,
      server_time: result.server_time,
    };
  }
}
