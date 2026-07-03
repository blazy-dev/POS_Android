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
React Native (App Móvil)
      │
      ▼ (HTTPS / API REST)
   NestJS (Backend en Railway)
      │
      ├──────────────────────┐
      ▼                      ▼
  Supabase               Redis (Caché & Colas)
 (PostgreSQL & Auth)
```

La definición operativa del stack, la estructura del repositorio y los comandos de arranque viven en [REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md) y [DEV_SETUP.md](DEV_SETUP.md).

---

## Esqueleto operativo

La app móvil opera sin internet, pero la sincronización, los conflictos y la fuente de verdad están definidos en [SYNC_STRATEGY.md](SYNC_STRATEGY.md).

La lógica de autenticación, tokens y registro de usuarios se define en [API_SPEC.md](API_SPEC.md) y en la documentación de conexión móvil/backend.

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

## Autenticación y Autorización

La autenticación principal será mediante Google OAuth delegada en Supabase Auth. El flujo detallado de registro, validación de JWT y creación del tenant vive en [API_SPEC.md](API_SPEC.md).

La app móvil usa login diario por PIN para cajeros; el detalle de ese flujo también está en [API_SPEC.md](API_SPEC.md).

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
* NestJS + Fastify + Prisma.
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
