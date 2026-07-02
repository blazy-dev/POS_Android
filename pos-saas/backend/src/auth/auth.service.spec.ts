import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

function createMockPrisma(overrides: Partial<PrismaService> = {}) {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    role: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    customer: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(createMockPrisma(overrides))),
    ...overrides,
  } as unknown as PrismaService;
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('findUserBySupabaseId', () => {
    it('deberia devolver el usuario si existe', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        tenant: { id: 'tenant-1', name: 'Test Store' },
        role: { id: 'role-1', name: 'admin' },
      };
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const result = await service.findUserBySupabaseId('user-1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { tenant: true, role: true },
      });
    });

    it('deberia devolver null si el usuario no existe', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await service.findUserBySupabaseId('no-existe');

      expect(result).toBeNull();
    });
  });

  describe('getTenant', () => {
    it('deberia devolver los datos del tenant', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Mi Comercio',
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
      };
      (prisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      const result = await service.getTenant('tenant-1');

      expect(result).toEqual(mockTenant);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
    });
  });

  describe('updateTenant', () => {
    it('deberia actualizar los campos del tenant', async () => {
      const mockUpdated = {
        id: 'tenant-1',
        name: 'Nuevo Nombre',
        currency: 'USD',
        timezone: 'America/New_York',
      };
      (prisma.tenant.update as any).mockResolvedValue(mockUpdated);

      const result = await service.updateTenant(
        'tenant-1',
        'Nuevo Nombre',
        'USD',
        'America/New_York',
      );

      expect(result).toEqual(mockUpdated);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          name: 'Nuevo Nombre',
          currency: 'USD',
          timezone: 'America/New_York',
        },
      });
    });
  });

  describe('registerOrLink', () => {
    it('deberia vincular un usuario existente a un nuevo tenant', async () => {
      const supabaseUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
      };

      (prisma.user.findUnique as any).mockResolvedValue(null);

      const txPrisma = createMockPrisma();
      (txPrisma.tenant.create as any).mockResolvedValue({ id: 'tenant-2' });
      (txPrisma.role.create as any).mockResolvedValue({ id: 'role-admin' });
      (txPrisma.role.createMany as any).mockResolvedValue({ count: 2 });
      (txPrisma.user.create as any).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: { id: 'role-admin', name: 'admin' },
        tenantId: 'tenant-2',
      });
      (txPrisma.customer.create as any).mockResolvedValue({ id: 'cust-1' });
      (txPrisma.auditLog.create as any).mockResolvedValue({ id: 'log-1' });

      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        return cb(txPrisma);
      });

      const result = await service.registerOrLink(
        supabaseUser,
        'Nuevo Comercio',
      );

      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(result.user.role).toBe('admin');
      expect(result.tenant.id).toBe('tenant-2');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('deberia devolver el usuario existente si ya esta vinculado', async () => {
      const supabaseUser = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
      };

      const existingUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@test.com',
        role: { id: 'role-1', name: 'admin' },
        tenant: {
          id: 'tenant-1',
          name: 'Mi Comercio',
          currency: 'ARS',
          timezone: 'America/Argentina/Buenos_Aires',
        },
      };

      (prisma.user.findUnique as any).mockResolvedValue(existingUser);
      (prisma.user.update as any).mockResolvedValue(existingUser);

      const result = await service.registerOrLink(supabaseUser);

      expect(result).toEqual({
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: 'admin',
        },
        tenant: {
          id: existingUser.tenant.id,
          name: existingUser.tenant.name,
          currency: existingUser.tenant.currency,
          timezone: existingUser.tenant.timezone,
        },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { tenant: true, role: true },
      });
    });
  });
});
