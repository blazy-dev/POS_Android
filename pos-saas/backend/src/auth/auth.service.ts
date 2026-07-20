import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async findUserBySupabaseId(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        role: true,
      },
    });
  }

  async registerOrLink(
    supabaseUser: { id: string; email: string; name: string },
    tenantName?: string,
    currency?: string,
    timezone?: string,
  ) {
    // 1. Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
      include: {
        tenant: true,
        role: true,
      },
    });

    if (existingUser) {
      const updatedUser = await this.prisma.user.update({
        where: { id: supabaseUser.id },
        data: { lastLoginAt: new Date() },
        include: {
          tenant: true,
          role: true,
        },
      });

      return {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role?.name || 'cashier',
        },
        tenant: {
          id: updatedUser.tenant.id,
          name: updatedUser.tenant.name,
          email: updatedUser.tenant.email,
          currency: updatedUser.tenant.currency,
          timezone: updatedUser.tenant.timezone,
          subscriptionStatus: updatedUser.tenant.subscriptionStatus,
          subscriptionEndsAt: updatedUser.tenant.subscriptionEndsAt
            ? updatedUser.tenant.subscriptionEndsAt.getTime()
            : 0,
          trialStart: updatedUser.tenant.trialStart
            ? updatedUser.tenant.trialStart.getTime()
            : null,
        },
      };
    }

    // 2. User does not exist, perform registration in a transaction
    const finalTenantName = tenantName || `${supabaseUser.name}'s POS`;

    const result = await this.prisma.$transaction(async (tx) => {
      // Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: finalTenantName,
          email: supabaseUser.email,
          currency: currency || 'ARS',
          timezone: timezone || 'America/Argentina/Buenos_Aires',
          subscriptionStatus: 'demo',
          trialStart: new Date(),
        },
      });

      // Create default Role 'admin' for the tenant
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'admin',
        },
      });

      // Create other helper roles: supervisor, cashier
      await tx.role.createMany({
        data: [
          { tenantId: tenant.id, name: 'supervisor' },
          { tenantId: tenant.id, name: 'cashier' },
        ],
      });

      // Create User linked to the tenant and role
      const user = await tx.user.create({
        data: {
          id: supabaseUser.id,
          tenantId: tenant.id,
          roleId: adminRole.id,
          name: supabaseUser.name,
          email: supabaseUser.email,
          lastLoginAt: new Date(),
        },
      });

      // Create default Customer "Consumidor Final"
      await tx.customer.create({
        data: {
          tenantId: tenant.id,
          name: 'Consumidor Final',
          phone: '',
          email: '',
          address: '',
        },
      });

      // Create Audit Log for registration
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'user_registration',
          entityType: 'user',
          entityId: user.id,
          metadataJson: {
            email: user.email,
            role: 'admin',
          },
        },
      });

      return { user, tenant, roleName: 'admin' };
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.roleName,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        email: result.tenant.email,
        currency: result.tenant.currency,
        timezone: result.tenant.timezone,
        subscriptionStatus: result.tenant.subscriptionStatus,
        subscriptionEndsAt: result.tenant.subscriptionEndsAt ? result.tenant.subscriptionEndsAt.getTime() : 0,
        trialStart: result.tenant.trialStart ? result.tenant.trialStart.getTime() : null,
      },
    };
  }

  async getTenant(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }

  async updateTenant(tenantId: string, name?: string, currency?: string, timezone?: string) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name && { name }),
        ...(currency && { currency }),
        ...(timezone && { timezone }),
      },
    });
  }

  async listAllTenantsForAdmin() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTenantSubscription(
    tenantId: string,
    status: string,
    endsAtMs?: number,
    trialStartMs?: number,
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: status,
        subscriptionEndsAt: endsAtMs ? new Date(endsAtMs) : null,
        trialStart: trialStartMs ? new Date(trialStartMs) : undefined,
      },
    });
  }
}
