# CONTROL_CAMBIOS_BACKEND.md — Backend NestJS

## Proposito

Cada vez que se modifica el backend, este checklist verifica que los
cambios no rompan la API ni la sincronizacion con el frontend y mobile.
Ejecutar antes de cada commit que toque archivos en `pos-saas/backend/`.

---

## Checklist de verificacion

### 1. Build y tipos

- [ ] `pnpm run build` completa sin errores en `pos-saas/backend/`
- [ ] No hay errores de tipos TypeScript
- [ ] `pnpm run lint` pasa sin errores criticos

### 2. Endpoints de autenticacion

| Endpoint | Metodo | Verificar |
|----------|--------|-----------|
| `/api/v1/auth/status` | GET | [ ] Retorna perfil del usuario si existe |
| `/api/v1/auth/register-or-link` | POST | [ ] Crea tenant + usuario + roles + cliente default |
| `/api/v1/auth/tenant` | GET | [ ] Retorna tenant del usuario actual |
| `/api/v1/auth/tenant` | PUT | [ ] Actualiza nombre/moneda/zona horaria |

### 3. Endpoints del dashboard

| Endpoint | Metodo | Verificar |
|----------|--------|-----------|
| `/api/v1/dashboard/metrics` | GET | [ ] Retorna metricas correctas |
| `/api/v1/dashboard/products` | GET | [ ] Lista productos activos del tenant |
| `/api/v1/dashboard/products` | POST | [ ] Crea producto, valida barcode unico |
| `/api/v1/dashboard/products/:id` | PUT | [ ] Actualiza producto |
| `/api/v1/dashboard/products/:id` | DELETE | [ ] Soft-delete (isActive=false) |
| `/api/v1/dashboard/categories` | GET | [ ] Lista categorias del tenant |
| `/api/v1/dashboard/categories` | POST | [ ] Crea categoria |
| `/api/v1/dashboard/sales` | GET | [ ] Lista ventas con items |
| `/api/v1/dashboard/employees` | GET | [ ] Lista usuarios con roles |
| `/api/v1/dashboard/employees` | POST | [ ] Crea empleado |
| `/api/v1/dashboard/employees/:id` | PUT | [ ] Actualiza empleado |

### 4. Endpoints de sincronizacion

| Endpoint | Metodo | Verificar |
|----------|--------|-----------|
| `/api/v1/sync/push` | POST | [ ] Procesa operaciones del mobile |
| `/api/v1/sync/pull` | GET | [ ] Retorna cambios desde last_sync_at |

### 5. Aislamiento multi-tenant

- [ ] Ningun endpoint retorna datos de otro tenant
- [ ] El tenant_id se extrae del JWT correctamente
- [ ] Las operaciones CRUD filtran por tenant_id

### 6. Validacion y seguridad

- [ ] Los DTOs rechazan campos no permitidos (whitelist)
- [ ] Los UUID params rechazan valores invalidos
- [ ] Los endpoints POST/PUT validan campos requeridos
- [ ] El JWT se valida en todos los endpoints protegidos
- [ ] CORS permite solo los origenes configurados

### 7. Base de datos

- [ ] Las migraciones de Prisma se aplican sin errores
- [ ] No hay queries N+1 en endpoints list
- [ ] Las relaciones (include) estan optimizadas

### 8. Tests

```powershell
cd pos-saas/backend
pnpm run test         # Unit tests
pnpm run test:e2e     # E2E tests
pnpm run test:cov     # Coverage
```

- [ ] Todos los tests pasan
- [ ] Coverage minima: >50% en servicios criticos

---

## Registro de cambios

| Fecha | Archivos modificados | Que se cambio | Tests ejecutados | Estado |
|-------|---------------------|---------------|-----------------|--------|
| | | | | |

---

## Comandos de verificacion

```powershell
# Build
cd pos-saas/backend
pnpm run build

# Tests unitarios
pnpm run test

# Tests e2e
pnpm run test:e2e

# Coverage
pnpm run test:cov

# Lint
pnpm run lint
```

---

## Orden de sincronizacion (para verificar despues de cambios en sync)

1. Productos
2. Categorias
3. Clientes
4. Inventario
5. Caja
6. Ventas

Si se modifica el endpoint de sync, verificar que el orden se mantiene.
