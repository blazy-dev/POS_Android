# PROJECT_CONTEXT.md

## Nombre del proyecto

**POS SaaS Android-First**

---

## Visión del producto

Crear una plataforma POS SaaS orientada a pequeños y medianos comercios que permita operar un negocio utilizando únicamente un teléfono Android.

El objetivo es eliminar la necesidad de comprar una computadora, reduciendo costos de adopción y facilitando la digitalización de los comercios.

La aplicación debe permitir gestionar ventas, inventario, clientes, caja y reportes desde un dispositivo móvil.

---

## Propuesta de valor

El comercio podrá operar completamente utilizando:

* Un teléfono Android.
* Un lector de códigos de barras.
* Una impresora térmica.

Sin necesidad de:

* Computadora.
* Servidor local.
* Infraestructura compleja.

---

## Antecedentes

Existe una versión funcional de escritorio desarrollada en Python, Tkinter y SQLite.

La aplicación actual incluye:

* Ventas.
* Inventario.
* Reportes.
* Generación de PDF.
* Impresión de precios.
* Módulos específicos como fiambrería.

La nueva plataforma no es una migración visual del sistema actual.

La versión de escritorio servirá como referencia funcional y fuente de conocimiento del negocio.

---

## Objetivos del proyecto

* Diseñar una plataforma Android-first.
* Implementar una arquitectura SaaS multiempresa.
* Permitir operación offline.
* Garantizar sincronización automática.
* Integrar hardware comercial.
* Escalar a múltiples sucursales y usuarios.

---

## Principios arquitectónicos

* Android-first.
* Mobile-first.
* Offline-first.
* API-first.
* Multi-tenant.
* Escalable.
* Modular.
* Seguro.
* Eventualmente multiplataforma.

---

## Arquitectura general

```text
Aplicación Android
        │
        ▼
      API REST
        │
        ▼
   PostgreSQL
```

Arquitectura extendida:

```text
React Native
      │
      ▼
   FastAPI
      │
 ┌────┼─────────┐
 ▼    ▼         ▼
PostgreSQL   Redis   Almacenamiento de archivos
```

---

## Stack tecnológico

### Frontend móvil

- React Native
- TypeScript
- Expo Development Build
- Expo Router
- SQLite local
- Zustand
- React Query

### Backend

* Python
* FastAPI
* SQLAlchemy
* Alembic
* Pydantic

### Base de datos

* PostgreSQL

### Infraestructura

* Railway

### Caché y colas

* Redis

### Monitoreo

* Sentry

---

## Filosofía offline-first

La operación del comercio no debe depender de internet.

La venta debe completarse localmente y sincronizarse posteriormente.

Flujo:

1. Escanear producto.
2. Buscar producto en SQLite local.
3. Agregar al carrito.
4. Confirmar venta.
5. Actualizar inventario local.
6. Imprimir ticket.
7. Registrar evento de sincronización.
8. Sincronizar cuando exista conectividad.

---

## Fuente de verdad

* PostgreSQL es la fuente de verdad global.
* SQLite es la fuente de verdad local temporal.
* El backend contiene toda la lógica de negocio.

No se duplicarán reglas críticas entre frontend y backend.

---

## Multiempresa (Multi-tenant)

Cada comercio es un tenant independiente.

Todas las entidades deben incluir:

* tenant_id

Todas las consultas deben filtrar obligatoriamente por tenant_id.

El acceso entre empresas está prohibido.

---

## Autenticación

La autenticación principal será mediante Google.

Tecnología:

* OAuth 2.0
* JWT
* Refresh tokens

### Flujo de registro

1. El usuario instala la aplicación.
2. Selecciona "Continuar con Google".
3. Autoriza el acceso.
4. El backend valida el token.
5. Se crea el usuario.
6. Se crea la empresa.
7. Se asigna el rol de administrador.
8. Se inicia la sincronización inicial.

---

## Gestión de empleados

Los empleados son creados por el administrador.

Roles iniciales:

* Administrador
* Supervisor
* Cajero

Métodos de acceso:

* Correo y contraseña.
* PIN de acceso rápido.
* Opcionalmente Google.

El acceso diario de cajeros debe realizarse preferentemente mediante PIN.

---

## Seguridad

Implementar:

* JWT de corta duración.
* Refresh tokens.
* Rotación de tokens.
* Cifrado de datos sensibles.
* Auditoría.
* Control de sesiones.
* Backups automáticos.

---

## Auditoría

Registrar:

* Usuario.
* Dispositivo.
* Acción.
* Fecha y hora.
* Entidad afectada.

Ejemplos:

* Venta anulada.
* Cambio de precios.
* Apertura de caja.
* Cierre de caja.

---

## Identificadores

Todas las entidades usarán UUID.

No se expondrán IDs autoincrementales.

---

## Sincronización

Requisitos:

* Cola local de operaciones.
* Sincronización incremental.
* Resolución de conflictos.
* Reintentos automáticos.
* Tolerancia a desconexiones.

Cada dispositivo tendrá:

* device_id

Cada operación tendrá:

* operation_id

---

## Hardware soportado

### Lectores de código de barras

* USB HID
* Bluetooth HID

### Impresoras térmicas

* ESC/POS
* Bluetooth
* Wi-Fi

Las integraciones con hardware deben abstraerse mediante servicios específicos.

---

## Módulos del MVP

* Autenticación
* Empresas
* Usuarios y roles
* Productos
* Categorías
* Inventario
* Ventas
* Caja
* Clientes
* Impresión
* Sincronización

---

## Módulos futuros

* Reportes avanzados
* Proveedores
* Compras
* Múltiples sucursales
* Gestión de empleados
* Dashboard web
* Integraciones contables
* Facturación electrónica
* Analytics

---

## Requisitos de experiencia de usuario

* Uso con una sola mano.
* Botones grandes.
* Navegación simple.
* Pocos pasos por operación.
* Soporte para modo oscuro.
* Optimizado para teléfonos Android de gama media.

Objetivo:

```text
Escanear → Cobrar → Imprimir
```

En menos de 10 segundos.

---

## Restricciones técnicas

* No depender de conexión permanente.
* No acceder directamente a PostgreSQL desde la app.
* No duplicar lógica de negocio.
* No bloquear ventas por fallas de sincronización.
* No depender de hardware propietario.

---

## Definición de éxito

El sistema será exitoso si un comercio puede:

* Instalar la aplicación.
* Registrarse con Google.
* Configurar su negocio.
* Cargar productos.
* Conectar lector e impresora.
* Realizar ventas.
* Consultar inventario.
* Operar durante todo el día sin computadora.

---

## Instrucciones para asistentes de IA

Actúa como un arquitecto de software senior especializado en:

* Sistemas POS.
* Aplicaciones móviles offline-first.
* React Native.
* FastAPI.
* PostgreSQL.
* Arquitecturas SaaS multi-tenant.
* Sincronización de datos.
* Integración con hardware comercial.

Antes de proponer código, prioriza:

1. Arquitectura.
2. Modelado de datos.
3. Definición de APIs.
4. Sincronización.
5. Seguridad.
6. Escalabilidad.
7. Experiencia de usuario.

Toda decisión debe justificarse considerando que Android es la plataforma principal del producto.
