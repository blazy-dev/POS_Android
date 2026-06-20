# ROADMAP.md

## Objetivo del MVP

Permitir que un comercio opere completamente utilizando:

* Un teléfono Android.
* Un lector de códigos de barras USB.
* Una impresora térmica (opcional en la primera etapa).

La aplicación debe funcionar sin internet.

---

# Fase 0 — Validación técnica

## Objetivo

Reducir riesgos antes de desarrollar.

## Entregables

* [x] Seleccionar teléfono Android de prueba.
* [x] Comprar o definir lector de códigos USB.
* [x] Verificar compatibilidad OTG.
* [x] Confirmar que el lector funciona como teclado HID.
* [x] Definir impresora térmica objetivo.
* [x] Crear repositorio monorepo.
* [x] Configurar entorno de desarrollo.

## Criterio de éxito

El teléfono recibe códigos de barras correctamente.

---

# Fase 1 — Infraestructura base

## Objetivo

Preparar la base técnica del proyecto.

## Entregables

### Backend

* [ ] Configurar FastAPI.
* [ ] Configurar PostgreSQL.
* [ ] Configurar Alembic.
* [ ] Configurar Railway.
* [ ] Configurar autenticación con Google.
* [ ] Configurar JWT.

### Mobile

* [x] Crear proyecto React Native.
* [x] Configurar TypeScript.
* [x] Configurar SQLite.
* [x] Configurar navegación.
* [ ] Configurar manejo de estado.
* [ ] Configurar almacenamiento seguro.

### DevOps

* [x] Configurar monorepo.
* [ ] Configurar CI/CD.
* [ ] Configurar linting.
* [ ] Configurar formateo.

## Criterio de éxito

La aplicación inicia sesión correctamente.

---

# Fase 2 — Gestión de productos

## Objetivo

Permitir la creación y consulta de productos.

## Entregables

* [x] Crear categorías.
* [x] Crear productos.
* [x] Escanear código de barras para autocompletar el campo.
* [x] Editar productos.
* [x] Buscar productos.
* [ ] Sincronizar productos.

## Criterio de éxito

Un usuario puede crear productos completamente desde el teléfono.

---

# Fase 3 — Inventario

## Objetivo

Gestionar stock.

## Entregables

* [x] Registrar stock inicial.
* [x] Consultar inventario.
* [x] Ajustar stock manualmente.
* [x] Registrar movimientos.
* [ ] Sincronizar movimientos.

## Criterio de éxito

El stock se mantiene consistente entre dispositivos.

---

# Fase 4 — Caja y ventas

## Objetivo

Implementar el flujo principal del negocio.

## Entregables

* [x] Abrir caja.
* [x] Inicio de sesión con PIN.
* [x] Escanear productos.
* [x] Agregar productos al carrito.
* [x] Cobrar en efectivo.
* [x] Cobrar por transferencia.
* [x] Registrar ventas localmente.
* [x] Actualizar stock.
* [x] Cerrar caja.

## Criterio de éxito

Completar una venta en menos de 10 segundos.

---

# Fase 5 — Sincronización

## Objetivo

Garantizar funcionamiento offline.

## Entregables

* [x] Implementar cola local.
* [x] Implementar sync push.
* [x] Implementar sync pull.
* [x] Resolver conflictos.
* [x] Reintentos automáticos.
* [x] Indicadores visuales.

## Criterio de éxito

La aplicación sigue operando sin internet.

---

# Fase 6 — Impresión

## Objetivo

Agregar tickets.

## Entregables

* [ ] Implementar PrinterService.
* [ ] Integrar impresora USB.
* [ ] Diseñar ticket.
* [ ] Reimprimir ticket.

## Criterio de éxito

La venta puede imprimirse desde el teléfono.

---

# Fase 7 — Reportes básicos

## Objetivo

Dar visibilidad al negocio.

## Entregables

* [x] Ventas del día.
* [x] Productos más vendidos.
* [x] Movimientos de caja.
* [x] Stock bajo.

## Criterio de éxito

El comerciante puede controlar su negocio desde la app.

---

# Fase 8 — Beta cerrada

## Objetivo

Validar el producto con clientes reales.

## Entregables

* [ ] Seleccionar comercios piloto.
* [ ] Instalar la aplicación.
* [ ] Recopilar feedback.
* [ ] Corregir errores.

## Criterio de éxito

Los comercios utilizan la aplicación diariamente.

---

# Fase 9 — Lanzamiento

## Objetivo

Publicar el producto.

## Entregables

* [ ] Crear onboarding.
* [ ] Configurar soporte.
* [ ] Configurar backups.
* [ ] Configurar monitoreo.
* [ ] Publicar versión estable.

## Criterio de éxito

Primeros clientes activos pagando.

---

# Métricas clave

* Tiempo promedio de venta.
* Tiempo de sincronización.
* Tasa de errores.
* Ventas perdidas.
* Tiempo de apertura de la app.
* Comercios activos.
* Retención mensual.

---

# Regla principal del proyecto

Siempre priorizar:

```text id="q4a6yo"
Escanear → Cobrar → Sincronizar
```

Todo lo demás es secundario.
