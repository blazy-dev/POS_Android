# PRODUCT_REQUIREMENTS.md

## MVP v1.0

El objetivo es que un comercio pueda operar completamente usando un teléfono Android, un lector de códigos de barras y una impresora térmica.

---

## Flujo 1: Registro del comercio

### Actor

Propietario.

### Pasos

1. Instala la aplicación.
2. Selecciona "Continuar con Google".
3. Autoriza el acceso.
4. Completa los datos del negocio:

   * Nombre comercial.
   * Moneda.
   * Zona horaria.
5. El sistema crea:

   * Tenant.
   * Usuario administrador.
   * Cliente predeterminado "Consumidor final".
   * Configuración inicial.

### Resultado esperado

El comercio queda listo para operar.

---

## Flujo 2: Alta de productos

### Actor

Administrador.

### Descripción

La carga de productos será manual y asistida por lector de códigos de barras.

No se implementarán importaciones masivas ni gestión de compras a proveedores en el MVP.

### Pasos

1. Acceder al módulo "Productos".
2. Seleccionar "Nuevo producto".
3. Escanear el código de barras utilizando el lector USB o ingresarlo manualmente.
4. Completar los datos:

* Nombre.
* Categoría.
* Precio de compra.
* Precio de venta.
* Stock inicial.
* Unidad de medida.

5. Guardar el producto.

### Reglas de negocio

* El código de barras debe ser único dentro del tenant.
* El código de barras es opcional.
* El sistema debe permitir productos sin código de barras.
* El stock inicial genera automáticamente un movimiento de inventario.
* El precio de venta no puede ser menor al precio de compra, salvo autorización del administrador.

### Resultado esperado

El producto queda disponible para la venta inmediatamente, incluso en modo offline.


## Flujo 3: Apertura de caja

### Actor

Cajero.

### Pasos

1. Inicia sesión mediante PIN.
2. Selecciona "Abrir caja".
3. Ingresa el monto inicial.

### Resultado esperado

La caja queda habilitada para operar.

---

## Flujo 4: Venta rápida

### Actor

Cajero.

### Pasos

1. Escanea un producto.
2. El sistema busca el producto localmente.
3. Agrega el producto al carrito.
4. Repite el proceso según sea necesario.
5. Selecciona el método de pago.
6. Confirma la venta.
7. El sistema:

   * Registra la venta localmente.
   * Actualiza el stock local.
   * Registra un evento de sincronización.
   * Imprime el ticket.

### Resultado esperado

La venta se completa en menos de 10 segundos.

---

## Flujo 5: Sincronización

### Actor

Sistema.

### Condición

Existe conexión a internet.

### Pasos

1. Detecta operaciones pendientes.
2. Envía los cambios al backend.
3. Confirma la recepción.
4. Marca las operaciones como sincronizadas.

### Resultado esperado

Los datos locales y remotos quedan consistentes.

> La estrategia técnica de sincronización, conflictos, reintentos y orden de sync se documenta en [SYNC_STRATEGY.md](SYNC_STRATEGY.md) y [SYNC_SKELETON.md](SYNC_SKELETON.md).

---

## Flujo 6: Cierre de caja

### Actor

Cajero.

### Pasos

1. Selecciona "Cerrar caja".
2. Ingresa el monto contado.
3. El sistema calcula diferencias.
4. Confirma el cierre.

### Resultado esperado

La caja queda cerrada y auditada.

---

## Requisitos no funcionales

* La aplicación debe iniciar en menos de 3 segundos.
* El tiempo entre escaneo y respuesta debe ser menor a 300 ms.
* La aplicación debe funcionar sin internet.
* Ninguna venta puede perderse.
* La sincronización debe ser automática.
* El consumo de batería debe ser bajo.
* La interfaz debe optimizarse para uso con una sola mano.

---

## Criterios de éxito

Un negocio puede:

* Instalar la aplicación.
* Registrarse.
* Cargar productos.
* Conectar el hardware.
* Vender.
* Imprimir tickets.
* Consultar inventario.

Sin utilizar una computadora.
