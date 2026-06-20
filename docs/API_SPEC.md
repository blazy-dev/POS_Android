# API_SPEC.md

## Información general

* Protocolo: HTTPS
* Estilo: REST
* Formato: JSON
* Versión inicial: v1
* Base URL:

```text
https://api.tudominio.com/api/v1
```

---

## Autenticación

La API utiliza:

* OAuth 2.0 con Google
* JWT Access Token
* Refresh Token

Todas las solicitudes protegidas deben incluir:

```http
Authorization: Bearer <access_token>
```

---

## Headers estándar

```http
Authorization: Bearer <token>
Content-Type: application/json
X-Device-Id: <uuid>
X-App-Version: 1.0.0
```

---

## Respuesta estándar

### Éxito

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Producto no encontrado"
  }
}
```

---

## Códigos HTTP

| Código | Uso                   |
| ------ | --------------------- |
| 200    | OK                    |
| 201    | Creado                |
| 400    | Solicitud inválida    |
| 401    | No autenticado        |
| 403    | Sin permisos          |
| 404    | Recurso no encontrado |
| 409    | Conflicto             |
| 422    | Error de validación   |
| 500    | Error interno         |

---

# AUTH

## POST /auth/google

Autentica un usuario mediante Google.

### Request

```json
{
  "id_token": "google_id_token"
}
```

### Response

```json
{
  "access_token": "jwt",
  "refresh_token": "jwt",
  "user": {},
  "tenant": {}
}
```

---

## POST /auth/pin-login

Inicio de sesión rápido para cajeros.

### Request

```json
{
  "device_id": "uuid",
  "pin": "1234"
}
```

### Response

```json
{
  "access_token": "jwt",
  "refresh_token": "jwt"
}
```

---

## POST /auth/refresh

Renueva el access token.

### Request

```json
{
  "refresh_token": "jwt"
}
```

### Response

```json
{
  "access_token": "jwt"
}
```

---

## POST /auth/logout

Cierra la sesión activa.

---

# PRODUCTS

## GET /products

Obtiene productos.

### Query params

```text
search=
page=
limit=
updated_after=
```

---

## GET /products/barcode/{barcode}

Busca un producto por código de barras.

---

## POST /products

Crea un producto.

### Request

```json
{
  "barcode": "7791234567890",
  "name": "Gaseosa Cola 2.25L",
  "category_id": "uuid",
  "purchase_price": 1200,
  "sale_price": 1800,
  "stock": 10,
  "unit": "unit"
}
```

---

## PUT /products/{id}

Actualiza un producto.

---

## DELETE /products/{id}

Realiza eliminación lógica.

---

# CATEGORIES

## GET /categories

Lista categorías.

---

## POST /categories

Crea una categoría.

---

# CUSTOMERS

## GET /customers

Lista clientes.

---

## POST /customers

Crea un cliente.

---

## GET /customers/default

Obtiene el cliente predeterminado.

---

# CASH REGISTERS

## POST /cash-registers/open

Abre una caja.

### Request

```json
{
  "opening_amount": 50000
}
```

---

## GET /cash-registers/current

Obtiene la caja actual.

---

## POST /cash-registers/close

Cierra una caja.

### Request

```json
{
  "closing_amount": 152500
}
```

---

# SALES

## POST /sales

Registra una venta.

### Request

```json
{
  "cash_register_id": "uuid",
  "customer_id": "uuid",
  "payment_method": "cash",
  "device_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "unit_price": 1800
    }
  ]
}
```

### Reglas

* Validar stock disponible.
* Calcular total en backend.
* Crear movimientos de inventario.
* Registrar auditoría.

---

## GET /sales

Lista ventas.

### Query params

```text
from=
to=
page=
limit=
```

---

## GET /sales/{id}

Obtiene el detalle de una venta.

---

## POST /sales/{id}/cancel

Anula una venta.

### Reglas

* Revertir stock.
* Registrar auditoría.

---

# INVENTORY

## GET /inventory/movements

Lista movimientos de stock.

---

## POST /inventory/adjustments

Ajusta stock manualmente.

### Request

```json
{
  "product_id": "uuid",
  "quantity": 5,
  "reason": "inventory_count"
}
```

---

# DEVICES

## POST /devices/register

Registra un dispositivo.

### Request

```json
{
  "name": "Samsung A55",
  "platform": "android"
}
```

---

## GET /devices/me

Obtiene información del dispositivo actual.

---

# SYNC

La sincronización es basada en operaciones, no en tablas.

---

## POST /sync/push

Envía operaciones pendientes.

### Request

```json
{
  "operations": [
    {
      "operation_id": "uuid",
      "entity_type": "sale",
      "entity_id": "uuid",
      "operation": "create",
      "payload": {}
    }
  ]
}
```

### Response

```json
{
  "processed": 10,
  "failed": 0
}
```

---

## GET /sync/pull

Obtiene cambios remotos.

### Query params

```text
last_sync_at=
```

### Response

```json
{
  "changes": []
}
```

---

# AUDIT

## GET /audit-logs

Obtiene eventos de auditoría.

---

# HEALTH

## GET /health

Verifica el estado de la API.

### Response

```json
{
  "status": "ok"
}
```

---

# Reglas globales

* Todos los recursos utilizan UUID.
* Todas las operaciones se filtran por tenant_id.
* Todas las fechas se almacenan en UTC.
* Todas las eliminaciones son lógicas.
* El backend es responsable de las reglas de negocio.
* La aplicación nunca accede directamente a PostgreSQL.
* La aplicación debe funcionar offline.

---

# Versionado

La API utilizará versionado por URL.

Ejemplo:

```text
/api/v1/products
/api/v2/products
```
