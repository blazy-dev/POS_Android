# REPOSITORY_STRUCTURE.md

```text
pos-saas/
│
├── apps/
│   │
│   ├── mobile/                  # Aplicación React Native
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── assets/
│   │   │   ├── components/
│   │   │   ├── database/
│   │   │   ├── hooks/
│   │   │   ├── modules/
│   │   │   ├── navigation/
│   │   │   ├── screens/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   ├── sync/
│   │   │   ├── theme/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   ├── android/
│   │   ├── ios/
│   │   ├── app.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    # Dashboard administrativo Next.js 16
│
├── backend/
│   │
│   ├── src/                    # Código fuente de NestJS
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── sales/
│   │   │   ├── cash_registers/
│   │   │   ├── sync/
│   │   │   └── users/
│   │   │
│   │   ├── common/             # Filtros, guards, interceptores globales
│   │   ├── main.ts             # Punto de entrada de la aplicación NestJS
│   │   └── app.module.ts       # Módulo raíz
│   │
│   ├── prisma/                 # Esquema de Prisma ORM y migraciones
│   │   └── schema.prisma
│   │
│   ├── test/                   # Pruebas e2e y unitarias
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── packages/
│   │
│   ├── api-types/              # Tipos compartidos
│   ├── eslint-config/
│   └── typescript-config/
│
├── scripts/                 # Scripts de desarrollo (arranque/parada de servicios)
│   ├── dev-start.ps1
│   └── dev-stop.ps1
│
├── docs/
│   ├── PROJECT.md
│   ├── PRODUCT_REQUIREMENTS.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPEC.md
│   ├── SYNC_STRATEGY.md
│   ├── HARDWARE.md
│   ├── REPOSITORY_STRUCTURE.md
│   └── ROADMAP.md
│
├── .github/
│   └── workflows/
│
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── turbo.json
```

## Decisiones de arquitectura

### Monorepo

Todo el código vive en un único repositorio.

Beneficios:

* Versionado centralizado.
* Reutilización de código.
* CI/CD simplificado.
* Mejor trazabilidad.

---

### Gestor del monorepo

Utilizar:

* Turborepo
* pnpm

---

### Convención de ramas

```text
main
develop
feature/*
fix/*
hotfix/*
```

---

### Convención de commits

Seguir Conventional Commits.

Ejemplos:

```text
feat: add barcode scanner support

fix: resolve inventory sync issue

docs: update api specification
```

---

### Variables de entorno

Cada aplicación tendrá su propio archivo:

```text
apps/mobile/.env
backend/.env
```

Nunca subir archivos `.env` al repositorio.

---

### Documentación

Toda decisión técnica debe documentarse en `/docs`.

La documentación es parte del producto.

```
```
