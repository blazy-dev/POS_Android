# DEV_SETUP.md — Guía de Entorno de Desarrollo Local

Esta guía explica cómo arrancar todos los servicios del proyecto en desarrollo local. El proyecto tiene **3 servicios independientes** que se corren en terminales separadas.

---

## 🗺️ Mapa de servicios

| Servicio | Tecnología | Puerto | Directorio |
|---------|-----------|--------|-----------|
| **Backend API** | NestJS + Fastify | `3001` | `pos-saas/backend/` |
| **Frontend Web** | Next.js 16 | `3000` | `pos-saas/apps/web/` |
| **App Mobile** | Expo (React Native) | `8081` (Metro) | `pos-saas/apps/mobile/` |

---

## 🔑 Variables de entorno

Cada servicio tiene su propio archivo de entorno. **Nunca subir estos archivos al repositorio.**

### Backend — `pos-saas/backend/.env`
```env
PROJECT_NAME="POS SaaS Android-First"
API_V1_STR="/api/v1"
ENVIRONMENT="development"
SECRET_KEY="development_secret_key_change_me_in_production"
ACCESS_TOKEN_EXPIRE_MINUTES=11520
DATABASE_URL="postgresql://postgres.<proyecto>:<password>@aws-1-us-west-2.pooler.supabase.com:5432/postgres"
SUPABASE_JWT_SECRET="<jwt_secret_del_dashboard_de_supabase>"
```

### Frontend Web — `pos-saas/apps/web/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

> ⚠️ `NEXT_PUBLIC_API_URL` **debe apuntar al puerto 3001** (backend). El frontend corre en 3000.

### Mobile — `pos-saas/apps/mobile/.env`
```env
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
```

---

## 🚀 Cómo arrancar los servicios

Abrí **3 terminales separadas** y ejecutá uno por terminal en el siguiente orden:

---

### Terminal 1 — Backend (NestJS)

```powershell
cd "pos-saas\backend"
pnpm run start:dev
```

✅ Listo cuando aparece:
```
[Nest] LOG [NestApplication] Nest application successfully started
Listening on: http://0.0.0.0:3001
```

---

### Terminal 2 — Frontend Web (Next.js)

```powershell
cd "pos-saas\apps\web"
node node_modules/next/dist/bin/next dev
```

> **¿Por qué no `pnpm run dev`?** El comando `pnpm run dev` ejecuta `pnpm install` internamente antes de lanzar el servidor. En esta configuración de monorepo, ese paso falla por conflictos de lockfiles entre subdirectorios. Usar `node node_modules/next/dist/bin/next dev` omite ese paso y lanza el servidor directamente.

✅ Listo cuando aparece:
```
▲ Next.js 16.x.x (Turbopack)
- Local: http://localhost:3000
✓ Ready in ~900ms
```

---

### Terminal 3 — App Mobile (Expo)

```powershell
cd "pos-saas\apps\mobile"
pnpm run android
```

O si preferís el menú interactivo de Expo:
```powershell
pnpm run start
```

Luego presionás:
- `a` → Abre en emulador/dispositivo Android
- `i` → Abre en simulador iOS
- `w` → Abre en navegador web

✅ Listo cuando aparece:
```
Metro waiting on exp://192.168.x.x:8081
› Press a │ open Android
```

> 📱 **Para correr en dispositivo físico**: instalá la app **Expo Go** desde la Play Store y escaneá el QR que aparece en la terminal.

---

## 🔄 Flujo de comunicación entre servicios

```
App Mobile (Expo)
    │
    ├─── Sincronización offline (SQLite local) ──▶ Backend API (3001)
    │         POST /api/v1/sync/push
    │         GET  /api/v1/sync/pull
    │
    └─── Autenticación ──────────────────────────▶ Supabase Auth

Frontend Web (Next.js 3000)
    │
    ├─── Gestión administrativa ──────────────────▶ Backend API (3001)
    │         GET  /api/v1/dashboard/metrics
    │         CRUD /api/v1/products
    │         CRUD /api/v1/employees
    │         GET  /api/v1/sales
    │
    └─── Autenticación Google OAuth ─────────────▶ Supabase Auth

Backend API (NestJS 3001)
    └─── Base de datos ───────────────────────────▶ PostgreSQL (Supabase)
```

---

## 🌐 Configuración de Supabase (obligatorio para OAuth)

Para que el login con Google funcione en desarrollo local, debés agregar las URLs de redirección en el dashboard de Supabase:

1. Ir a: **Authentication → URL Configuration** en [supabase.com/dashboard](https://supabase.com/dashboard)
2. Configurar:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs** (agregar ambas):
     ```
     http://localhost:3000
     http://localhost:3000/**
     ```
3. Guardar cambios

---

## 🚀 Scripts de arranque y parada automatica

Para no tener que abrir 3 terminales manualmente cada vez, usa los scripts incluidos en `scripts/`:

```powershell
# Arranca los 3 servicios en Windows Terminal (3 pestanas)
.\scripts\dev-start.ps1

# Arranca solo un servicio especifico
.\scripts\dev-start.ps1 -Backend
.\scripts\dev-start.ps1 -Web
.\scripts\dev-start.ps1 -Mobile

# Detiene los 3 servicios matando los procesos en sus puertos
.\scripts\dev-stop.ps1

# Detiene solo un servicio
.\scripts\dev-stop.ps1 -Web
```

### Comportamiento de los scripts

- `dev-start.ps1` instala automaticamente las dependencias si `node_modules` no existe (solo la primera vez).
- `dev-start.ps1` abre **Windows Terminal** con una pestana por cada servicio (fallback a ventanas separadas si no esta instalado).
- Cada ventana muestra los logs de su servicio en tiempo real.
- `dev-stop.ps1` busca los procesos que ocupan los puertos 3000, 3001 y 8081 y los mata con `taskkill /F`.

### Flujo de trabajo recomendado

Si estas haciendo cambios en el backend y queres verificar que el frontend y mobile no se rompan:

1. Ejecuta `.\scripts\dev-start.ps1` para encender todo en Windows Terminal.
2. Modifica el codigo del backend — NestJS se reinicia solo con `--watch`.
3. En las otras pestanas, el frontend (Next.js con Turbopack) y mobile (Expo con Fast Refresh) tambien se recargan automaticamente.
4. Si necesitas reiniciar solo un servicio: `.\scripts\dev-stop.ps1 -Backend` y despues `.\scripts\dev-start.ps1 -Backend`.

---

## 🛑 Como detener los servicios manualmente

Si preferis hacerlo a mano, podes usar `Ctrl+C` en cada terminal, o matar por puerto:

```powershell
# Buscar el PID que usa el puerto (ejemplo: 3001)
netstat -ano | findstr ":3001"

# Matar el proceso por PID
taskkill /PID <PID> /F
```

---

## ⚡ Troubleshooting común

| Problema | Causa | Solución |
|---------|-------|---------|
| `Port 3000 is in use` | Ya hay un proceso de Next.js corriendo | `taskkill /PID <PID> /F` |
| `Port 3001 is in use` | El backend ya está corriendo | `taskkill /PID <PID> /F` |
| Login de Google queda atascado | URL de redirección no configurada en Supabase | Agregar `http://localhost:3000` en Supabase Dashboard |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm bloquea scripts de build | Usar `node node_modules/next/dist/bin/next dev` en vez de `pnpm run dev` para el web |
| Error 401 en el backend | JWT secret incorrecto o token expirado | Verificar `SUPABASE_JWT_SECRET` en `backend/.env` |
| Sync falla con `Unique constraint` en email | Operación de sync con email duplicado | El upsert de usuarios ya usa `where: { email }` como clave única |
