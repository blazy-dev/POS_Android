import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus';
import * as crypto from 'crypto';

@Controller('dashboard')
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  private async getTenantOwnerEmail(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { email: true },
    });

    return tenant?.email || null;
  }

  private emit(entityType: string, operation: 'create' | 'update' | 'delete', entityId: string, tenantId?: string) {
    this.eventBus.emit({ entityType, operation, entityId, tenantId, timestamp: new Date().toISOString() });
  }

  // ==========================================
  // PRODUCTS CRUD
  // ==========================================

  @Get('products')
  async getProducts(@CurrentUser() user: any) {
    return this.prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        barcode: true,
        name: true,
        purchasePrice: true,
        salePrice: true,
        stock: true,
        minimumStock: true,
        unit: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('products')
  async createProduct(@CurrentUser() user: any, @Body() body: any) {
    if (!body.name) {
      throw new BadRequestException('Product name is required');
    }

    if (body.barcode) {
      const trimmedBarcode = body.barcode.trim();
      const existing = await this.prisma.product.findFirst({
        where: {
          tenantId: user.tenantId,
          barcode: trimmedBarcode,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `A product with barcode "${trimmedBarcode}" already exists (id: ${existing.id}). Delete or rename the existing barcode first.`,
        );
      }
    }

    // Self-healing: resolve categoryId from name if not a valid UUID
    const categoryId = await this.resolveCategoryId(user.tenantId, body.categoryId);
    const barcode = body.barcode?.trim() || undefined;

    const product = await this.prisma.product.create({
      data: {
        tenantId: user.tenantId,
        barcode,
        name: body.name,
        description: body.description || null,
        categoryId,
        purchasePrice: Number(body.purchasePrice) || 0,
        salePrice: Number(body.salePrice) || 0,
        costPrice: Number(body.costPrice) || 0,
        stock: Number(body.stock) || 0,
        minimumStock: Number(body.minimumStock) || 0,
        unit: body.unit || 'unit',
        isActive: true,
      },
    });

    this.emit('product', 'create', product.id, user.tenantId);
    return product;
  }

  @Put('products/:id')
  async updateProduct(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (body.barcode && body.barcode !== product.barcode) {
      const existing = await this.prisma.product.findFirst({
        where: {
          tenantId: user.tenantId,
          barcode: body.barcode,
          isActive: true,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException('A product with this barcode already exists');
      }
    }

    const categoryId =
      body.categoryId !== undefined
        ? await this.resolveCategoryId(user.tenantId, body.categoryId)
        : product.categoryId;

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        barcode: body.barcode !== undefined ? body.barcode : product.barcode,
        name: body.name !== undefined ? body.name : product.name,
        description: body.description !== undefined ? body.description : product.description,
        categoryId,
        purchasePrice: body.purchasePrice !== undefined ? body.purchasePrice : product.purchasePrice,
        salePrice: body.salePrice !== undefined ? body.salePrice : product.salePrice,
        costPrice: body.costPrice !== undefined ? body.costPrice : product.costPrice,
        stock: body.stock !== undefined ? body.stock : product.stock,
        minimumStock: body.minimumStock !== undefined ? body.minimumStock : product.minimumStock,
        unit: body.unit !== undefined ? body.unit : product.unit,
      },
    });

    this.emit('product', 'update', updatedProduct.id, user.tenantId);
    return updatedProduct;
  }

  @Delete('products/:id')
  async deleteProduct(@CurrentUser() user: any, @Param('id') id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const deletedProduct = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    this.emit('product', 'delete', deletedProduct.id, user.tenantId);
    return deletedProduct;
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  @Get('categories')
  async getCategories(@CurrentUser() user: any) {
    return this.prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  @Post('categories')
  async createCategory(@CurrentUser() user: any, @Body() body: any) {
    if (!body.name) {
      throw new BadRequestException('Category name is required');
    }

    const category = await this.prisma.category.create({
      data: {
        tenantId: user.tenantId,
        name: body.name,
      },
    });

    this.emit('category', 'create', category.id, user.tenantId);
    return category;
  }

  // ==========================================
  // EMPLOYEES (USERS) CRUD
  // ==========================================

  @Get('employees')
  async getEmployees(@CurrentUser() user: any) {
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('employees')
  async createEmployee(@CurrentUser() user: any, @Body() body: any) {
    if (user.role?.name !== 'admin') {
      throw new ForbiddenException('Only administrators can manage employees');
    }

    if (!body.name || !body.email || !body.roleName) {
      throw new BadRequestException('Name, email, and role name are required');
    }

    // Check if email already registered
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      throw new BadRequestException('User with this email is already registered');
    }

    // Find role ID for tenant
    const role = await this.prisma.role.findFirst({
      where: {
        tenantId: user.tenantId,
        name: body.roleName.toLowerCase(),
      },
    });

    if (!role) {
      throw new BadRequestException(`Role '${body.roleName}' not found for this tenant`);
    }

    const employee = await this.prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        roleId: role.id,
        name: body.name,
        email: body.email,
        pin: body.pin || null,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    this.emit('user', 'create', employee.id, user.tenantId);
    return employee;
  }

  @Put('employees/:id')
  async updateEmployee(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    if (user.role?.name !== 'admin') {
      throw new ForbiddenException('Only administrators can manage employees');
    }

    const employee = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const ownerEmail = await this.getTenantOwnerEmail(user.tenantId);
    if (ownerEmail && employee.email === ownerEmail && body.isActive === false) {
      throw new ForbiddenException('No puedes dar de baja al usuario principal del comercio');
    }

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.pin !== undefined) data.pin = body.pin;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    if (body.roleName) {
      const role = await this.prisma.role.findFirst({
        where: {
          tenantId: user.tenantId,
          name: body.roleName.toLowerCase(),
        },
      });
      if (!role) {
        throw new BadRequestException(`Role '${body.roleName}' not found for this tenant`);
      }
      data.roleId = role.id;
    }

    const updatedEmployee = await this.prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });

    this.emit('user', 'update', updatedEmployee.id, user.tenantId);
    return updatedEmployee;
  }

  @Delete('employees/:id')
  async deleteEmployee(@CurrentUser() user: any, @Param('id') id: string) {
    if (user.role?.name !== 'admin') {
      throw new ForbiddenException('Only administrators can manage employees');
    }

    // Don't allow self-deletion
    if (user.id === id) {
      throw new BadRequestException('You cannot deactivate yourself');
    }

    const employee = await this.prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const ownerEmail = await this.getTenantOwnerEmail(user.tenantId);
    if (ownerEmail && employee.email === ownerEmail) {
      throw new ForbiddenException('No puedes eliminar al usuario principal del comercio');
    }

    const deletedEmployee = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: { role: true },
    });

    this.emit('user', 'delete', deletedEmployee.id, user.tenantId);
    return deletedEmployee;
  }

  // ==========================================
  // SALES AND METRICS
  // ==========================================

  @Get('sales')
  async getSales(@CurrentUser() user: any) {
    return this.prisma.sale.findMany({
      where: { tenantId: user.tenantId },
      include: {
        user: true,
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  @Get('metrics')
  async getMetrics(@CurrentUser() user: any) {
    // 1. Sales query
    const sales = await this.prisma.sale.findMany({
      where: { tenantId: user.tenantId },
      select: {
        total: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    // 2. Products stock counts
    const activeProducts = await this.prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
      select: {
        stock: true,
        minimumStock: true,
      },
    });

    let totalRevenue = 0;
    const paymentMethodsCount: { [key: string]: number } = {};
    const paymentMethodsRevenue: { [key: string]: number } = {};

    sales.forEach((s) => {
      const val = Number(s.total) || 0;
      totalRevenue += val;

      const method = s.paymentMethod || 'cash';
      paymentMethodsCount[method] = (paymentMethodsCount[method] || 0) + 1;
      paymentMethodsRevenue[method] = (paymentMethodsRevenue[method] || 0) + val;
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;

    activeProducts.forEach((p) => {
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.minimumStock) || 0;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    });

    // 3. Recent 5 sales
    const recentSales = await this.prisma.sale.findMany({
      where: { tenantId: user.tenantId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    return {
      totalRevenue,
      totalSalesCount: sales.length,
      lowStockCount,
      outOfStockCount,
      paymentMethods: {
        counts: paymentMethodsCount,
        revenue: paymentMethodsRevenue,
      },
      recentSales: recentSales.map((s) => ({
        id: s.id,
        total: Number(s.total),
        paymentMethod: s.paymentMethod,
        cashier: s.user?.name || 'Unknown',
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * Resuelve un categoryId a un UUID valido.
   * Si el valor no es un UUID (ej: "Bebidas"), busca o crea la categoria por nombre.
   */
  private async resolveCategoryId(
    tenantId: string,
    categoryId: string | undefined | null,
  ): Promise<string | null> {
    if (!categoryId) return null;

    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (uuidRegex.test(categoryId)) {
      return categoryId;
    }

    // No es UUID -> es un nombre de categoria. Buscar o crear.
    const existing = await this.prisma.category.findFirst({
      where: { tenantId, name: categoryId },
    });

    if (existing) return existing.id;

    const created = await this.prisma.category.create({
      data: { tenantId, name: categoryId },
    });

    return created.id;
  }
}
