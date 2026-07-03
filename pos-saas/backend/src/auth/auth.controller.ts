import { Controller, Post, Get, Put, Body, UseGuards, ForbiddenException } from '@nestjs/common';
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
}
