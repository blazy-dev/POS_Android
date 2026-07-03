# POS SaaS Android-First — Offline-First

Sistema de Punto de Venta (POS) multiempresa (SaaS) con enfoque **Android-First** y **Offline-First**. Permite a pequeños y medianos comercios operar 100% offline y sincronizar automáticamente sus datos en la nube (PostgreSQL) cuando disponen de conexion a internet.

---

## Requisitos Previos

| Herramienta | Version minima | Para que |
|---|---|---|
| **Git** | cualquiera | Clonar y gestionar el repositorio |
| **Node.js** | v18+ | Backend, frontend web y mobile |
| **pnpm** | 8+ | Gestion de paquetes y monorepo |
| **Expo Go** (App) | ultima | Pruebas rapidas en celular fisico |
| **Android Studio** (opcional) | ultima | Depuracion avanzada en emulador |

```powershell
npm install -g pnpm
```

---

## Estructura del Repositorio

```text
pos-saas/
├── apps/
│   ├── mobile/              # App movil React Native (Expo)
│   │   └── src/
│   │       ├── api/         # Cliente API REST
│   │       ├── components/  # Componentes reutilizables
│   │       ├── database/    # SQLite local
│   │       ├── modules/     # Modulos de negocio
│   │       ├── navigation/  # Navegacion Expo Router
│   │       ├── screens/     # Pantallas
│   │       ├── services/    # Servicios de hardware
│   │       ├── store/       # Estado global (Zustand)
│   │       └── sync/        # Cola de sincronizacion offline
│   │
│   └── web/                 # Dashboard administrativo Next.js 16
│       └── src/
│           └── app/
│               ├── dashboard/   # Panel protegido (productos, ventas, empleados)
│               └── login/       # Google OAuth
│
├── backend/                 # API NestJS + Fastify + Prisma
│   ├── src/
│   │   └── modules/         # auth, products, inventory, sales, sync, etc.
│   └── prisma/              # Esquema de base de datos y migraciones
│
├── packages/                # Tipos y configuraciones compartidas
│   ├── api-types/
│   ├── eslint-config/
│   └── typescript-config/
│
└── docs/                    # Documentacion de diseno y arquitectura
```

---

## Arranque Rapido

Si solo queres ver el proyecto corriendo, usa los scripts preconfigurados:

```powershell
# Enciende backend + web + mobile en Windows Terminal (3 pestanas)
.\scripts\dev-start.ps1

# Detiene los 3 servicios
.\scripts\dev-stop.ps1

# Arrancar solo uno
.\scripts\dev-start.ps1 -Backend
```

Para instrucciones detalladas, lee [docs/DEV_SETUP.md](docs/DEV_SETUP.md).

---

## Servicios

| Servicio | Tecnologia | Puerto | Comando |
|---|---|---|---|
| **Backend API** | NestJS + Fastify + Prisma | `3001` | `pnpm run start:dev` (desde `pos-saas/backend/`) |
| **Frontend Web** | Next.js 16 + shadcn/ui | `3000` | `node node_modules/next/dist/bin/next dev` (desde `pos-saas/apps/web/`) |
| **App Mobile** | Expo (React Native) | `8081` (Metro) | `pnpm run start` (desde `pos-saas/apps/mobile/`) |

---

## Funcionamiento de la Sincronizacion

* **Offline-First**: todas las ventas, movimientos de stock y aperturas de caja se guardan primero en SQLite local del dispositivo.
* **Sincronizacion basada en operaciones**: cada accion (crear producto, realizar venta, ajustar inventario) se registra como una operacion pendiente que se envia al backend cuando hay internet.
* **Push** (`POST /sync/push`): envia operaciones locales al servidor.
* **Pull** (`GET /sync/pull`): descarga cambios remotos desde la ultima sincronizacion.

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| **Mobile** | React Native + Expo + SQLite + Zustand + React Query |
| **Backend** | NestJS + Fastify + Prisma ORM |
| **Frontend Web** | Next.js 16 + React 19 + shadcn/ui + Tailwind CSS |
| **Base de datos** | PostgreSQL (Supabase) + SQLite (local) |
| **Autenticacion** | Supabase Auth (Google OAuth) + JWT |
| **Monorepo** | pnpm workspaces + Turborepo |

---

## Documentacion Relacionada

* [Mapa de documentacion](docs/README.md)
