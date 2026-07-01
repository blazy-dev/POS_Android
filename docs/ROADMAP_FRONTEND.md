# ROADMAP_FRONTEND.md — Dashboard Web (Next.js 16)

## Stack actual

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Auth | Supabase Auth (Google OAuth) |
| Estado servidor | TanStack Query v5 (instalado, no usado) |
| Estado global | React Context (AuthContext) |
| HTTP client | fetch nativo (sin wrapper) |

---

## Lo que YA existe

### Paginas

| Ruta | Archivo | Estado | Descripcion |
|------|---------|--------|-------------|
| `/` | `app/page.tsx` | ✅ | Redirect a /dashboard o /login |
| `/login` | `app/login/page.tsx` | ✅ | Login con Google OAuth |
| `/dashboard` | `app/dashboard/page.tsx` | ✅ | Metricas: ingresos, ventas, stock bajo, pagos |
| `/dashboard/products` | `app/dashboard/products/page.tsx` | ✅ | CRUD productos + categorias |
| `/dashboard/sales` | `app/dashboard/sales/page.tsx` | ✅ | Historial de ventas con detalle |
| `/dashboard/employees` | `app/dashboard/employees/page.tsx` | ✅ | CRUD empleados, roles, PINs |

### Componentes UI (shadcn/ui)

| Componente | Archivo | Estado |
|-----------|---------|--------|
| Button | `components/ui/button.tsx` | ✅ |
| Card | `components/ui/card.tsx` | ✅ |
| Badge | `components/ui/badge.tsx` | ✅ |
| Input | `components/ui/input.tsx` | ✅ |
| Dialog | `components/ui/dialog.tsx` | ✅ |
| Table | `components/ui/table.tsx` | ✅ |

### Infraestructura

| Modulo | Archivo | Estado |
|--------|---------|--------|
| Auth | `context/AuthContext.tsx` | ✅ |
| Supabase client | `lib/supabase.ts` | ✅ |
| Utilidades | `lib/utils.ts` (cn) | ✅ |
| Providers | `components/Providers.tsx` | ✅ |

### Endpoints backend consumidos

| Endpoint | Metodo | Pagina |
|----------|--------|--------|
| `/auth/status` | GET | AuthContext |
| `/auth/register-or-link` | POST | AuthContext |
| `/dashboard/metrics` | GET | dashboard/page.tsx |
| `/dashboard/products` | GET/POST/PUT/DELETE | products/page.tsx |
| `/dashboard/categories` | GET/POST | products/page.tsx |
| `/dashboard/sales` | GET | sales/page.tsx |
| `/dashboard/employees` | GET/POST/PUT | employees/page.tsx |

---

## Lo que FALTA

### Fase A — Estabilizacion (actual)

| # | Tarea | Estado | Prioridad |
|---|-------|--------|-----------|
| A1 | Crear `src/lib/api.ts` con URL centralizada | ✅ Completado | Alta |
| A2 | Reemplazar fallbacks incorrectos (:3000 → :3001) en 4 archivos | ✅ Completado (resuelto con A1) | Alta |
| A3 | Configurar ESLint + Prettier en apps/web | ⬜ Pendiente | Alta |
| A4 | Agregar manejo de errores (error boundaries, toasts) | ✅ Completado (ErrorBoundary + ErrorMessage) | Media |
| A5 | Agregar loading states en todas las paginas | ✅ Completado (Spinner compartido) | Media |
| A6 | Configurar tests (Vitest o Jest) | ⬜ Pendiente | Media |

### Fase B — Funcionalidad faltante

| # | Tarea | Endpoint backend | Estado |
|---|-------|-----------------|--------|
| B1 | Pagina de Reportes (ventas del dia, top productos, stock) | `/dashboard/metrics` (ya existe) | ⬜ Pendiente |
| B2 | Gestion de Clientes (CRUD) | `/customers` (backend sync lo maneja) | ⬜ Pendiente |
| B3 | Historial de movimientos de inventario | `/inventory/movements` | ⬜ Pendiente |
| B4 | Gestion de cajas (ver abiertas/cerradas) | `/cash-registers` | ⬜ Pendiente |

### Fase C — Calidad y UX

| # | Tarea | Estado |
|---|-------|--------|
| C1 | Tests unitarios de componentes | ⬜ Pendiente |
| C2 | Tests de integracion (paginas + API) | ⬜ Pendiente |
| C3 | Pagina de perfil de usuario | ⬜ Pendiente |
| C4 | Pagina de configuracion del tenant | ⬜ Pendiente |
| C5 | Modo oscuro | ⬜ Pendiente |
| C6 | Paginacion en listas (productos, ventas, empleados) | ⬜ Pendiente |
| C7 | Busqueda con debounce en productos | ⬜ Pendiente |
| C8 | Confirmacion antes de eliminar | ⬜ Pendiente |

### Fase D — Pre-produccion

| # | Tarea | Estado |
|---|-------|--------|
| D1 | CI/CD (GitHub Actions: lint + test + build) | ⬜ Pendiente |
| D2 | Variables de entorno para produccion | ⬜ Pendiente |
| D3 | Sentry (monitoreo de errores) | ⬜ Pendiente |
| D4 | Optimizacion de bundle (lazy loading, dynamic imports) | ⬜ Pendiente |
| D5 | Meta tags, SEO, manifest | ⬜ Pendiente |

---

## Componentes UI faltantes (shadcn/ui)

| Componente | Utilidad | Estado |
|-----------|----------|--------|
| Select | Filtros, dropdowns | ⬜ Pendiente |
| Table (mejorada) | Paginacion, sorting | ⬜ Pendiente |
| Toast/Sonner | Notificaciones | ⬜ Pendiente |
| DropdownMenu | Menus de acciones | ⬜ Pendiente |
| Skeleton | Loading states | ⬜ Pendiente |
| Alert | Confirmaciones | ⬜ Pendiente |
| Tabs | Organizar contenido | ⬜ Pendiente |
| Form | Formularios con validacion | ⬜ Pendiente |

---

## Convenciones

- Todos los componentes van en `src/components/ui/` (shadcn/ui)
- Todas las paginas van en `src/app/dashboard/` (excepto login)
- Los hooks custom van en `src/hooks/`
- La URL del API se importa de `src/lib/api.ts`
- Usar `cn()` de `src/lib/utils.ts` para combinar clases
- Nomenclatura: `PascalCase` para componentes, `camelCase` para funciones/variables
