# DATABASE_SCHEMA.md

## Principios generales

* Todas las entidades utilizan UUID como clave primaria.
* Todas las entidades de negocio incluyen `tenant_id`.
* Todas las tablas incluyen auditoría básica.
* Todas las fechas se almacenan en UTC.
* PostgreSQL es la fuente de verdad global.
* SQLite almacena una copia parcial para funcionamiento offline.

Campos estándar:

```sql
id UUID PRIMARY KEY
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
deleted_at TIMESTAMP WITH TIME ZONE NULL
```

Soft delete:

* Nunca eliminar registros críticos.
* Utilizar `deleted_at`.

---

## Tenant

Representa una empresa o comercio.

| Campo      | Tipo         | Descripción         |
| ---------- | ------------ | ------------------- |
| id         | UUID         | Identificador único |
| name       | VARCHAR(150) | Nombre comercial    |
| email      | VARCHAR(255) | Correo principal    |
| phone      | VARCHAR(30)  | Teléfono            |
| currency   | VARCHAR(10)  | Moneda              |
| timezone   | VARCHAR(50)  | Zona horaria        |
| created_at | TIMESTAMP    | Fecha de creación   |

Relaciones:

* Un tenant tiene muchos usuarios.
* Un tenant tiene muchos productos.
* Un tenant tiene muchas ventas.

---

## User

Representa propietarios y empleados.

| Campo         | Tipo              | Descripción |
| ------------- | ----------------- | ----------- |
| id            | UUID              | Clave primaria (coincide con `auth.users.id` de Supabase para usuarios OAuth) |
| tenant_id     | UUID              | Relación con Tenant |
| role_id       | UUID              | Relación con Role |
| name          | VARCHAR(150)      | Nombre completo |
| email         | VARCHAR(255)      | Correo (único) |
| pin           | VARCHAR(255) NULL | PIN de acceso rápido para cajeros |
| password_hash | VARCHAR(255) NULL | Hash de contraseña (usado opcionalmente para acceso tradicional) |
| is_active     | BOOLEAN           | Estado del usuario |
| last_login_at | TIMESTAMP         | Último inicio de sesión |

Reglas:

* El propietario y los usuarios principales se registran mediante Supabase Auth (Google OAuth). Su `id` en `public.users` debe ser idéntico al `id` generado en el esquema `auth.users` de Supabase.
* Los cajeros o supervisores locales creados por el administrador pueden autenticarse con PIN en el dispositivo móvil local, o registrarse en Supabase Auth si requieren credenciales completas de sincronización remota.

---

## Role

Roles del sistema.

| Campo     | Tipo        |
| --------- | ----------- |
| id        | UUID        |
| tenant_id | UUID        |
| name      | VARCHAR(50) |

Valores iniciales:

* admin
* supervisor
* cashier

---

## Product

Productos disponibles para la venta.

| Campo          | Tipo          |
| -------------- | ------------- |
| id             | UUID          |
| tenant_id      | UUID          |
| barcode        | VARCHAR(100)  |
| name           | VARCHAR(255)  |
| description    | TEXT          |
| category_id    | UUID          |
| purchase_price | DECIMAL(12,2) |
| sale_price     | DECIMAL(12,2) |
| cost_price     | DECIMAL(12,2) |
| stock          | DECIMAL(12,3) |
| minimum_stock  | DECIMAL(12,3) |
| unit           | VARCHAR(20)   |
| is_active      | BOOLEAN       |

Reglas:

* `barcode` debe ser único por tenant.

---

## Category

Categorías de productos.

| Campo     | Tipo         |
| --------- | ------------ |
| id        | UUID         |
| tenant_id | UUID         |
| name      | VARCHAR(100) |

---

## Customer

Clientes del comercio.

| Campo     | Tipo         |
| --------- | ------------ |
| id        | UUID         |
| tenant_id | UUID         |
| name      | VARCHAR(255) |
| phone     | VARCHAR(30)  |
| email     | VARCHAR(255) |
| address   | TEXT         |

---

## CashRegister

Representa una caja abierta.

| Campo          | Tipo               |
| -------------- | ------------------ |
| id             | UUID               |
| tenant_id      | UUID               |
| opened_by      | UUID               |
| opened_at      | TIMESTAMP          |
| closed_at      | TIMESTAMP NULL     |
| opening_amount | DECIMAL(12,2)      |
| closing_amount | DECIMAL(12,2) NULL |
| status         | VARCHAR(20)        |

Estados:

* open
* closed

---

## Sale

Encabezado de venta.

| Campo            | Tipo          |
| ---------------- | ------------- |
| id               | UUID          |
| tenant_id        | UUID          |
| cash_register_id | UUID          |
| customer_id      | UUID NULL     |
| user_id          | UUID          |
| total            | DECIMAL(12,2) |
| payment_method   | VARCHAR(50)   |
| status           | VARCHAR(20)   |
| device_id        | UUID          |

Estados:

* completed
* canceled

---

## SaleItem

Detalle de venta.

| Campo      | Tipo          |
| ---------- | ------------- |
| id         | UUID          |
| sale_id    | UUID          |
| product_id | UUID          |
| quantity   | DECIMAL(12,3) |
| unit_price | DECIMAL(12,2) |
| subtotal   | DECIMAL(12,2) |

---

## InventoryMovement

Historial de stock.

| Campo          | Tipo          |
| -------------- | ------------- |
| id             | UUID          |
| tenant_id      | UUID          |
| product_id     | UUID          |
| user_id        | UUID          |
| reference_type | VARCHAR(50)   |
| reference_id   | UUID          |
| movement_type  | VARCHAR(20)   |
| quantity       | DECIMAL(12,3) |

Tipos:

* sale
* purchase
* adjustment
* return

Movimientos:

* in
* out

---

## Device

Dispositivos registrados.

| Campo        | Tipo         |
| ------------ | ------------ |
| id           | UUID         |
| tenant_id    | UUID         |
| name         | VARCHAR(100) |
| platform     | VARCHAR(20)  |
| last_sync_at | TIMESTAMP    |

---

## SyncOperation

Cola de sincronización.

| Campo       | Tipo        |
| ----------- | ----------- |
| id          | UUID        |
| device_id   | UUID        |
| entity_type | VARCHAR(50) |
| entity_id   | UUID        |
| operation   | VARCHAR(20) |
| payload     | JSONB       |
| status      | VARCHAR(20) |
| retries     | INTEGER     |

Estados:

* pending
* synced
* failed

Operaciones:

* create
* update
* delete

---

## AuditLog

Registro de auditoría.

| Campo       | Tipo         |
| ----------- | ------------ |
| id          | UUID         |
| tenant_id   | UUID         |
| user_id     | UUID         |
| device_id   | UUID         |
| action      | VARCHAR(100) |
| entity_type | VARCHAR(50)  |
| entity_id   | UUID         |
| metadata    | JSONB        |

Ejemplos:

* create_sale
* cancel_sale
* update_price
* open_cash_register

---

## Relaciones principales

```text
Tenant
├── Users
├── Roles
├── Products
├── Categories
├── Customers
├── Devices
├── CashRegisters
├── Sales
└── AuditLogs

Sale
├── SaleItems
└── InventoryMovements

Product
├── InventoryMovements
└── Categories
```
