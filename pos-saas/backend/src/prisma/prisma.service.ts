import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  private getDatabaseTarget(): string {
    const databaseUrl = process.env.DATABASE_URL || '';
    try {
      const parsed = new URL(databaseUrl);
      const host = parsed.hostname || 'unknown-host';
      const port = parsed.port || '5432';
      return `${host}:${port}`;
    } catch {
      return 'invalid-database-url';
    }
  }

  async onModuleInit() {
    this.logger.log(`DATABASE_URL target: ${this.getDatabaseTarget()}`);
    try {
      await this.$connect();
    } catch (err: any) {
      this.logger.warn(
        `Prisma could not connect during startup: ${err?.code || err?.message || err}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
