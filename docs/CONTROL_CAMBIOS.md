# CONTROL_CAMBIOS.md — Frontend Web

## Proposito

Cada vez que se modifica el frontend web, este checklist verifica que los
cambios no rompan funcionalidad existente. Ejecutar antes de cada commit
que toque archivos en `pos-saas/apps/web/`.

---

## Checklist de verificacion

### 1. Build y tipos

- [ ] `pnpm run build` completa sin errores en `pos-saas/apps/web/`
- [ ] No hay errores de tipos TypeScript
- [ ] No hay warnings criticos en la build

### 2. Endpoints consumidos

Verificar que cada endpoint sigue funcionando correctamente:

| Endpoint | Pagina que lo usa | Verificar |
|----------|-------------------|-----------|
| `GET /api/v1/auth/status` | AuthContext | [ ] Login sigue funcionando |
| `POST /api/v1/auth/register-or-link` | AuthContext | [ ] Registro de usuario nuevo funciona |
| `GET /api/v1/dashboard/metrics` | dashboard/page.tsx | [ ] Metricas cargan correctamente |
| `GET /api/v1/dashboard/products` | products/page.tsx | [ ] Lista de productos carga |
| `POST /api/v1/dashboard/products` | products/page.tsx | [ ] Crear producto funciona |
| `PUT /api/v1/dashboard/products/:id` | products/page.tsx | [ ] Editar producto funciona |
| `DELETE /api/v1/dashboard/products/:id` | products/page.tsx | [ ] Eliminar producto funciona |
| `GET /api/v1/dashboard/categories` | products/page.tsx | [ ] Categorias cargan |
| `POST /api/v1/dashboard/categories` | products/page.tsx | [ ] Crear categoria funciona |
| `GET /api/v1/dashboard/sales` | sales/page.tsx | [ ] Lista de ventas carga |
| `GET /api/v1/dashboard/employees` | employees/page.tsx | [ ] Lista de empleados carga |
| `POST /api/v1/dashboard/employees` | employees/page.tsx | [ ] Crear empleado funciona |
| `PUT /api/v1/dashboard/employees/:id` | employees/page.tsx | [ ] Editar empleado funciona |

### 3. Flujo de autenticacion

- [ ] Login con Google OAuth redirige al dashboard
- [ ] Si el backend esta caido, la app no se rompe (graceful degradation)
- [ ] Logout funciona y redirige a /login
- [ ] La sesion persiste al recargar la pagina

### 4. Navegacion

- [ ] Sidebar muestra solo las opciones del rol del usuario
- [ ] Navegar entre paginas no produce errores de hidratacion
- [ ] El layout del dashboard se mantiene consistente

### 5. UI/UX

- [ ] Los loading states se muestran mientras se cargan datos
- [ ] Los errores de API se muestran al usuario (no quedan en blanco)
- [ ] Los formularios validan antes de enviar
- [ ] Los modales se abren y cierran correctamente
- [ ] Los botones de accion tienen feedback visual

### 6. Variables de entorno

- [ ] `NEXT_PUBLIC_API_URL` apunta a `http://localhost:3001/api/v1`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` es correcto
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` es correcto

---

## Registro de cambios

Cada vez que se modifique el frontend, agregar una entrada aqui:

| Fecha | Archivos modificados | Que se cambio | Tests ejecutados | Estado |
|-------|---------------------|---------------|-----------------|--------|
| 2026-07-01 | api.ts, spinner.tsx, error-message.tsx, ErrorBoundary.tsx, AuthContext.tsx, dashboard/page.tsx, products/page.tsx, sales/page.tsx, employees/page.tsx, Providers.tsx, .env.example | URL centralizada, componentes compartidos, ErrorBoundary, fix puerto :3000→:3001 | `next build` OK | ✅ |

---

## Comandos de verificacion

```powershell
# Build del frontend
cd pos-saas/apps\web
pnpm run build

# Lint (si esta configurado)
pnpm run lint

# Tests (cuando existan)
pnpm run test
```
