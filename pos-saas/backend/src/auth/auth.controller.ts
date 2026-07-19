import { Controller, Post, Get, Put, Body, UseGuards, ForbiddenException, Param } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase.guard';
import { CurrentSupabaseUser, CurrentUser } from './user.decorator';
import { AuthService } from './auth.service';

class RegisterDto {
  tenant_name?: string;
  currency?: string;
  timezone?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('status')
  @UseGuards(SupabaseAuthGuard)
  async getStatus(@CurrentSupabaseUser() supabaseUser: any) {
    const existingUser = await this.authService.findUserBySupabaseId(supabaseUser.id);
    if (existingUser) {
      return {
        success: true,
        data: {
          exists: true,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role?.name || 'cashier',
          },
          tenant: {
            id: existingUser.tenant.id,
            name: existingUser.tenant.name,
            email: existingUser.tenant.email,
            currency: existingUser.tenant.currency,
            timezone: existingUser.tenant.timezone,
            subscriptionStatus: existingUser.tenant.subscriptionStatus,
            subscriptionEndsAt: existingUser.tenant.subscriptionEndsAt ? existingUser.tenant.subscriptionEndsAt.getTime() : 0,
            trialStart: existingUser.tenant.trialStart ? existingUser.tenant.trialStart.getTime() : null,
          },
        },
        message: null,
      };
    }

    return {
      success: true,
      data: {
        exists: false,
      },
      message: null,
    };
  }

  @Post('register-or-link')
  @UseGuards(SupabaseAuthGuard)
  async registerOrLink(
    @CurrentSupabaseUser() supabaseUser: any,
    @Body() body: RegisterDto,
  ) {
    const result = await this.authService.registerOrLink(
      supabaseUser,
      body?.tenant_name,
      body?.currency,
      body?.timezone,
    );
    return {
      success: true,
      data: result,
      message: null,
    };
  }

  @Get('tenant')
  @UseGuards(SupabaseAuthGuard)
  async getTenant(@CurrentUser() user: any) {
    const tenant = await this.authService.getTenant(user.tenantId);
    return {
      success: true,
      data: tenant,
      message: null,
    };
  }

  @Put('tenant')
  @UseGuards(SupabaseAuthGuard)
  async updateTenant(
    @CurrentUser() user: any,
    @Body() body: { name?: string; currency?: string; timezone?: string },
  ) {
    // Solo permitimos modificar los datos si el rol del usuario es admin
    const roleName = user.role?.name || 'cashier';
    if (roleName !== 'admin') {
      throw new ForbiddenException('Solo el administrador puede modificar la configuración del comercio');
    }

    const result = await this.authService.updateTenant(
      user.tenantId,
      body.name,
      body.currency,
      body.timezone,
    );

    return {
      success: true,
      data: result,
      message: null,
    };
  }

  @Get('admin/tenants')
  @UseGuards(SupabaseAuthGuard)
  async getTenantsForAdmin(@CurrentUser() user: any) {
    if (user.email !== 'tecno.juy.ar@gmail.com') {
      throw new ForbiddenException('Only the platform administrator can access this resource.');
    }

    const tenants = await this.authService.listAllTenantsForAdmin();
    return {
      success: true,
      data: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        ownerEmail: t.email || 'Sin email registrado',
        status: t.subscriptionStatus || 'demo',
        endsAt: t.subscriptionEndsAt ? t.subscriptionEndsAt.getTime() : 0,
        trialStart: t.trialStart ? t.trialStart.getTime() : null,
      })),
      message: null,
    };
  }

  @Put('admin/tenant/:id/subscription')
  @UseGuards(SupabaseAuthGuard)
  async updateTenantSubscription(
    @CurrentUser() user: any,
    @Param('id') tenantId: string,
    @Body() body: { status: string; endsAt?: number; trialStart?: number },
  ) {
    if (user.email !== 'tecno.juy.ar@gmail.com') {
      throw new ForbiddenException('Only the platform administrator can modify subscriptions.');
    }

    const result = await this.authService.updateTenantSubscription(
      tenantId,
      body.status,
      body.endsAt,
      body.trialStart,
    );

    return {
      success: true,
      data: {
        id: result.id,
        status: result.subscriptionStatus,
        endsAt: result.subscriptionEndsAt ? result.subscriptionEndsAt.getTime() : 0,
        trialStart: result.trialStart ? result.trialStart.getTime() : null,
      },
      message: null,
    };
  }
}
