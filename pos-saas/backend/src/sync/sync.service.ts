import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus';
import * as crypto from 'crypto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  private toUuid(str: string): string {
    if (!str) return '00000000-0000-0000-0000-000000000000';
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str)) {
      return str.toLowerCase();
    }
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-a${hash.slice(15, 18)}-${hash.slice(18, 30)}`;
  }

  async pushOperations(tenantId: string, deviceId: string, operations: any[]) {
    let processed = 0;
    let failed = 0;
    const failedIds: string[] = [];
    const validDeviceId = this.toUuid(deviceId);

    // Register or update device
    try {
      await this.prisma.device.upsert({
        where: { id: validDeviceId },
        create: {
          id: validDeviceId,
          tenantId,
          name: deviceId,
          platform: 'android',
          lastSyncAt: new Date(),
        },
        update: {
          lastSyncAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to register device ${deviceId}: ${err.message}`);
    }

    for (const op of operations) {
      const { operation_id, entity_type, entity_id, operation, payload } = op;
      const validOpId = this.toUuid(operation_id);
      const validEntityId = this.toUuid(entity_id);

      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. Audit/Log the sync operation in database
          await tx.syncOperation.upsert({
            where: { id: validOpId },
            create: {
              id: validOpId,
              deviceId: validDeviceId,
              entityType: entity_type,
              entityId: validEntityId,
              operation,
              payload: payload || {},
              status: 'synced',
            },
            update: {
              status: 'synced',
              updatedAt: new Date(),
            },
          });

          // 2. Perform the operation
          if (operation === 'delete') {
            if (entity_type === 'product') {
              await tx.product.updateMany({
                where: { id: validEntityId },
                data: { isActive: false },
              });
            } else if (entity_type === 'user') {
              const existingUser = await tx.user.findUnique({
                where: { id: validEntityId },
                select: { email: true },
              });
              const tenant = await tx.tenant.findUnique({
                where: { id: tenantId },
                select: { email: true },
              });

              if (existingUser && tenant?.email && existingUser.email === tenant.email) {
                throw new Error('Cannot delete tenant owner');
              }

              await tx.user.updateMany({
                where: { id: validEntityId },
                data: { isActive: false },
              });
            } else if (entity_type === 'category') {
              try {
                await tx.category.delete({ where: { id: validEntityId } });
              } catch (e) {
                // If it fails because of references or doesn't exist, we can ignore or log it
              }
            } else if (entity_type === 'customer') {
              try {
                await tx.customer.delete({ where: { id: validEntityId } });
              } catch (e) {}
            } else if (entity_type === 'cash_register') {
              try {
                await tx.cashRegister.delete({ where: { id: validEntityId } });
              } catch (e) {}
            } else if (entity_type === 'sale') {
              try {
                await tx.sale.delete({ where: { id: validEntityId } });
              } catch (e) {}
            } else if (entity_type === 'inventory_movement') {
              try {
                await tx.inventoryMovement.delete({ where: { id: validEntityId } });
              } catch (e) {}
            }
          } else {
            // create or update
            if (entity_type === 'category') {
              const clean = this.cleanCategory(payload, tenantId);
              await tx.category.upsert({
                where: { id: validEntityId },
                create: clean,
                update: clean,
              });
            } else if (entity_type === 'product') {
              const clean = this.cleanProduct(payload, tenantId);
              
              // Self-healing: Ensure referenced category exists
              if (clean.categoryId) {
                const rawCategoryName = payload.category || 'Sin Categoría';
                await tx.category.upsert({
                  where: { id: clean.categoryId },
                  create: {
                    id: clean.categoryId,
                    tenantId,
                    name: rawCategoryName,
                  },
                  update: {
                    name: rawCategoryName,
                  },
                });
              }

              await tx.product.upsert({
                where: { id: validEntityId },
                create: clean,
                update: clean,
              });
            } else if (entity_type === 'customer') {
              const clean = this.cleanCustomer(payload, tenantId);
              await tx.customer.upsert({
                where: { id: validEntityId },
                create: clean,
                update: clean,
              });
            } else if (entity_type === 'cash_register') {
              const clean = this.cleanCashRegister(payload, tenantId);
              
              // Self-healing: Ensure user exists
              if (clean.openedBy) {
                await tx.user.upsert({
                  where: { id: clean.openedBy },
                  create: {
                    id: clean.openedBy,
                    tenantId,
                    name: 'Usuario Caja',
                    email: `caja-${clean.openedBy}@pos.local`,
                  },
                  update: {},
                });
              }

              await tx.cashRegister.upsert({
                where: { id: validEntityId },
                create: clean,
                update: clean,
              });
            } else if (entity_type === 'sale') {
              const clean = this.cleanSale(payload, tenantId);

              // Self-healing: Ensure cash register exists
              if (clean.cashRegisterId) {
                await tx.cashRegister.upsert({
                  where: { id: clean.cashRegisterId },
                  create: {
                    id: clean.cashRegisterId,
                    tenantId,
                    openedAt: new Date(),
                    openingAmount: 0,
                    status: 'open',
                  },
                  update: {},
                });
              }

              // Self-healing: Ensure customer exists
              if (clean.customerId) {
                await tx.customer.upsert({
                  where: { id: clean.customerId },
                  create: {
                    id: clean.customerId,
                    tenantId,
                    name: 'Consumidor Sincronizado',
                  },
                  update: {},
                });
              }

              // Self-healing: Ensure user exists
              if (clean.userId) {
                await tx.user.upsert({
                  where: { id: clean.userId },
                  create: {
                    id: clean.userId,
                    tenantId,
                    name: 'Usuario Venta',
                    email: `venta-${clean.userId}@pos.local`,
                  },
                  update: {},
                });
              }

              await tx.sale.upsert({
                where: { id: validEntityId },
                create: clean,
                update: clean,
              });

              // Process nested items
              if (payload.items && Array.isArray(payload.items)) {
                for (const item of payload.items) {
                  const validItemId = this.toUuid(item.id);
                  const validProductId = this.toUuid(item.product_id);

                  // Safely parse numbers to avoid NaN validation exceptions in Prisma
                  const qty = isNaN(Number(item.quantity)) ? 0 : Number(item.quantity);
                  const price = isNaN(Number(item.unit_price ?? item.unitPrice)) ? 0 : Number(item.unit_price ?? item.unitPrice);
                  const sub = isNaN(Number(item.subtotal ?? item.subTotal)) ? 0 : Number(item.subtotal ?? item.subTotal);

                  // Self-healing: Ensure product exists for the sale item
                  await tx.product.upsert({
                    where: { id: validProductId },
                    create: {
                      id: validProductId,
                      tenantId,
                      name: item.product_name || 'Producto Sincronizado',
                      purchasePrice: 0,
                      salePrice: price,
                      costPrice: 0,
                      stock: 0,
                    },
                    update: {},
                  });

                  await tx.saleItem.upsert({
                    where: { id: validItemId },
                    create: {
                      id: validItemId,
                      saleId: validEntityId,
                      productId: validProductId,
                      quantity: qty,
                      unitPrice: price,
                      subtotal: sub,
                      createdAt: item.created_at ? new Date(item.created_at) : undefined,
                      updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
                    },
                    update: {
                      productId: validProductId,
                      quantity: qty,
                      unitPrice: price,
                      subtotal: sub,
                      updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
                    },
                  });
                }
              }
            } else if (entity_type === 'inventory_movement') {
              const clean = this.cleanInventoryMovement(payload, tenantId);

              // Self-healing: Ensure product exists
              if (clean.productId) {
                await tx.product.upsert({
                  where: { id: clean.productId },
                  create: {
                    id: clean.productId,
                    tenantId,
                    name: payload.product_name || 'Producto Sincronizado',
                    purchasePrice: 0,
                    salePrice: 0,
                    costPrice: 0,
                    stock: 0,
                  },
                  update: {},
                });
              }

              // Self-healing: Ensure user exists
              if (clean.userId) {
                await tx.user.upsert({
                  where: { id: clean.userId },
                  create: {
                    id: clean.userId,
                    tenantId,
                    name: 'Usuario Movimiento',
                    email: `mov-${clean.userId}@pos.local`,
                  },
                  update: {},
                });
              }

              await tx.inventoryMovement.upsert({
                where: { id: validEntityId },
                create: clean,
                update: clean,
              });
            } else if (entity_type === 'user') {
              this.logger.log(
                `PUSH user: ${payload.email} role=${payload.role} to tenant=${tenantId}`,
              );
              const clean = this.cleanUser(payload, tenantId);
              if (payload.role) {
                let role = await tx.role.findFirst({
                  where: { tenantId, name: payload.role },
                });
                if (!role) {
                  role = await tx.role.create({
                    data: { tenantId, name: payload.role },
                  });
                }
                clean.roleId = role.id;
              }
              await tx.user.upsert({
                where: { email: clean.email },
                create: clean,
                update: clean,
              });
            }
          }
        }, {
          maxWait: 15000,
          timeout: 60000,
        });

        processed++;

        // Emitir evento en tiempo real para que la web refresque
        this.eventBus.emit({
          entityType: entity_type,
          operation,
          entityId: validEntityId,
          tenantId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.error(`Error syncing operation ${operation_id}: ${err.message}`, err.stack);
        failed++;
        failedIds.push(operation_id);

        // Update sync operation to failed status
        try {
          await this.prisma.syncOperation.upsert({
            where: { id: validOpId },
            create: {
              id: validOpId,
              deviceId: validDeviceId,
              entityType: entity_type,
              entityId: validEntityId,
              operation,
              payload: payload || {},
              status: 'failed',
              retries: 1,
            },
            update: {
              status: 'failed',
              retries: { increment: 1 },
              updatedAt: new Date(),
            },
          });
        } catch (e) {
          // ignore double failure
        }
      }
    }

    // Write batch audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          deviceId: validDeviceId,
          action: 'sync_push',
          entityType: 'sync_operation',
          metadataJson: {
            total_operations: operations.length,
            processed,
            failed,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create sync audit log: ${err.message}`);
    }

    return { processed, failed, failedIds };
  }

  async pullChanges(tenantId: string, deviceId: string, lastSyncAt: string | null) {
    const changes: any[] = [];
    const serverTime = new Date().toISOString();
    const validDeviceId = this.toUuid(deviceId);

    // Register or update device
    try {
      await this.prisma.device.upsert({
        where: { id: validDeviceId },
        create: {
          id: validDeviceId,
          tenantId,
          name: deviceId,
          platform: 'android',
          lastSyncAt: new Date(),
        },
        update: {
          lastSyncAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to update device during pull: ${err.message}`);
    }

    const filter: any = { tenantId };
    if (lastSyncAt) {
      filter.updatedAt = { gt: new Date(lastSyncAt) };
    }

    // 1. Categories
    const categories = await this.prisma.category.findMany({ where: filter });
    for (const category of categories) {
      changes.push({
        id: category.id,
        entity_type: 'category',
        entity_id: category.id,
        operation: 'update',
        payload: {
          id: category.id,
          tenant_id: category.tenantId,
          name: category.name,
          created_at: category.createdAt.toISOString(),
          updated_at: category.updatedAt.toISOString(),
        },
        created_at: category.updatedAt.toISOString(),
      });
    }

    // 2. Products
    const products = await this.prisma.product.findMany({ where: filter });
    for (const product of products) {
      changes.push({
        id: product.id,
        entity_type: 'product',
        entity_id: product.id,
        operation: product.isActive ? 'update' : 'delete',
        payload: {
          id: product.id,
          tenant_id: product.tenantId,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          category_id: product.categoryId,
          purchase_price: Number(product.purchasePrice),
          sale_price: Number(product.salePrice),
          cost_price: Number(product.costPrice),
          stock: Number(product.stock),
          minimum_stock: Number(product.minimumStock),
          unit: product.unit,
          is_active: product.isActive,
          created_at: product.createdAt.toISOString(),
          updated_at: product.updatedAt.toISOString(),
        },
        created_at: product.updatedAt.toISOString(),
      });
    }

    // 3. Customers
    const customers = await this.prisma.customer.findMany({ where: filter });
    for (const customer of customers) {
      changes.push({
        id: customer.id,
        entity_type: 'customer',
        entity_id: customer.id,
        operation: 'update',
        payload: {
          id: customer.id,
          tenant_id: customer.tenantId,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          created_at: customer.createdAt.toISOString(),
          updated_at: customer.updatedAt.toISOString(),
        },
        created_at: customer.updatedAt.toISOString(),
      });
    }

    // 4. Cash Registers
    const cashRegisters = await this.prisma.cashRegister.findMany({ where: filter });
    for (const register of cashRegisters) {
      changes.push({
        id: register.id,
        entity_type: 'cash_register',
        entity_id: register.id,
        operation: 'update',
        payload: {
          id: register.id,
          tenant_id: register.tenantId,
          opened_by: register.openedBy,
          opened_at: register.openedAt.toISOString(),
          closed_at: register.closedAt?.toISOString() || null,
          opening_amount: Number(register.openingAmount),
          closing_amount: register.closingAmount ? Number(register.closingAmount) : null,
          status: register.status,
          created_at: register.createdAt.toISOString(),
          updated_at: register.updatedAt.toISOString(),
        },
        created_at: register.updatedAt.toISOString(),
      });
    }

    // 5. Sales
    const sales = await this.prisma.sale.findMany({
      where: filter,
      include: { items: true },
    });
    for (const sale of sales) {
      changes.push({
        id: sale.id,
        entity_type: 'sale',
        entity_id: sale.id,
        operation: 'update',
        payload: {
          id: sale.id,
          tenant_id: sale.tenantId,
          cash_register_id: sale.cashRegisterId,
          customer_id: sale.customerId,
          user_id: sale.userId,
          total: Number(sale.total),
          payment_method: sale.paymentMethod,
          status: sale.status,
          device_id: sale.deviceId,
          created_at: sale.createdAt.toISOString(),
          updated_at: sale.updatedAt.toISOString(),
          items: sale.items.map((item) => ({
            id: item.id,
            sale_id: item.saleId,
            product_id: item.productId,
            quantity: Number(item.quantity),
            unit_price: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            created_at: item.createdAt.toISOString(),
            updated_at: item.updatedAt.toISOString(),
          })),
        },
        created_at: sale.updatedAt.toISOString(),
      });
    }

    // 6. Inventory Movements
    const inventoryMovements = await this.prisma.inventoryMovement.findMany({ where: filter });
    for (const movement of inventoryMovements) {
      changes.push({
        id: movement.id,
        entity_type: 'inventory_movement',
        entity_id: movement.id,
        operation: 'update',
        payload: {
          id: movement.id,
          tenant_id: movement.tenantId,
          product_id: movement.productId,
          user_id: movement.userId,
          reference_type: movement.referenceType,
          reference_id: movement.referenceId,
          movement_type: movement.movementType,
          quantity: Number(movement.quantity),
          created_at: movement.createdAt.toISOString(),
          updated_at: movement.updatedAt.toISOString(),
        },
        created_at: movement.updatedAt.toISOString(),
      });
    }

    // 7. Users / Employees
    const users = await this.prisma.user.findMany({
      where: filter,
      include: { role: true },
    });
    for (const u of users) {
      changes.push({
        id: u.id,
        entity_type: 'user',
        entity_id: u.id,
        operation: u.isActive ? 'update' : 'delete',
        payload: {
          id: u.id,
          tenant_id: u.tenantId,
          name: u.name,
          email: u.email,
          pin: u.pin,
          role: u.role?.name || 'cashier',
          is_active: u.isActive,
          created_at: u.createdAt.toISOString(),
          updated_at: u.updatedAt.toISOString(),
        },
        created_at: u.updatedAt.toISOString(),
      });
    }

    // Write audit log
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          deviceId: validDeviceId,
          action: 'sync_pull',
          entityType: 'sync_operation',
          metadataJson: {
            last_sync_at: lastSyncAt,
            changes_count: changes.length,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pull audit log: ${err.message}`);
    }

    return {
      changes,
      server_time: serverTime,
    };
  }

  private cleanCategory(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      name: payload.name,
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };
  }

  private cleanProduct(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      barcode: payload.barcode || null,
      name: payload.name,
      description: payload.description || null,
      categoryId: payload.category_id ? this.toUuid(payload.category_id) : null,
      purchasePrice: payload.purchase_price !== undefined ? Number(payload.purchase_price) : 0,
      salePrice: payload.sale_price !== undefined ? Number(payload.sale_price) : 0,
      costPrice: payload.cost_price !== undefined ? Number(payload.cost_price) : 0,
      stock: payload.stock !== undefined ? Number(payload.stock) : 0,
      minimumStock: payload.minimum_stock !== undefined ? Number(payload.minimum_stock) : 0,
      unit: payload.unit || 'unit',
      isActive: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };
  }

  private cleanCustomer(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
      address: payload.address || null,
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };
  }

  private cleanCashRegister(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      openedBy: payload.opened_by ? this.toUuid(payload.opened_by) : null,
      openedAt: payload.opened_at ? new Date(payload.opened_at) : new Date(),
      closedAt: payload.closed_at ? new Date(payload.closed_at) : null,
      openingAmount: payload.opening_amount !== undefined ? Number(payload.opening_amount) : 0,
      closingAmount: payload.closing_amount !== undefined ? Number(payload.closing_amount) : null,
      status: payload.status || 'open',
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };
  }

  private cleanSale(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      cashRegisterId: payload.cash_register_id ? this.toUuid(payload.cash_register_id) : null,
      customerId: payload.customer_id ? this.toUuid(payload.customer_id) : null,
      userId: payload.user_id ? this.toUuid(payload.user_id) : null,
      total: payload.total !== undefined ? Number(payload.total) : 0,
      paymentMethod: payload.payment_method || 'cash',
      status: payload.status || 'completed',
      deviceId: payload.device_id ? this.toUuid(payload.device_id) : null,
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };
  }

  private cleanInventoryMovement(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      productId: this.toUuid(payload.product_id),
      userId: payload.user_id ? this.toUuid(payload.user_id) : null,
      referenceType: payload.reference_type || null,
      referenceId: payload.reference_id ? this.toUuid(payload.reference_id) : null,
      movementType: payload.movement_type,
      quantity: payload.quantity !== undefined ? Number(payload.quantity) : 0,
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
    };
  }

  private cleanUser(payload: any, tenantId: string) {
    return {
      id: this.toUuid(payload.id),
      tenantId,
      name: payload.name,
      email: payload.email,
      pin: payload.pin || null,
      passwordHash: payload.password_hash || null,
      isActive: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      createdAt: payload.created_at ? new Date(payload.created_at) : undefined,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
      roleId: undefined as string | undefined,
    };
  }
}
