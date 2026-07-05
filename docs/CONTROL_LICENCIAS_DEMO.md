# Especificación Técnica: Control de Licencias y Versión Demo

Este documento describe la arquitectura, las reglas del negocio, el modelo de persistencia, la retención de datos en SQLite local, la integración con Supabase Storage y el funcionamiento de la Consola de Administración de Licencias.

---

## 1. Modelo de Datos y Metadatos en SQLite

Para asegurar un funcionamiento totalmente offline-first, los límites y el estado de la suscripción se almacenan en la tabla local de configuraciones clave-valor `app_metadata` (`META_TABLE`) bajo las siguientes claves estructuradas por comercio (`tenantId`):

| Clave Metadato | Tipo de Dato | Valores Posibles | Propósito |
|---|---|---|---|
| `tenant_subscription_status_${tenantId}` | String | `'demo' \| 'active' \| 'expired'` | Estado general de la licencia del comercio. |
| `tenant_trial_start_${tenantId}` | Number | Timestamp (milisegundos) | Momento en el que el comercio inició el uso del trial. |
| `tenant_subscription_ends_at_${tenantId}` | Number | Timestamp (milisegundos) | Fecha límite de la suscripción mensual de pago. |
| `tenant_logo_${tenantId}` | String | Ruta de archivo local o URL pública | Imagen del logotipo del comercio cargada por el usuario. |

### Reglas de Inicialización:
* Cuando un comercio inicia sesión o crea su cuenta, la app consulta el backend (Supabase) para sincronizar su estado.
* Si el comercio es local (offline) o no hay conexión de red, la app inicializa los valores por defecto:
  * `tenant_subscription_status` = `'demo'`
  * `tenant_trial_start` = timestamp actual.
  * `tenant_subscription_ends_at` = 0 (sin suscripción paga activa).

---

## 2. Reglas de Negocio y Políticas de Retención de Datos

Las restricciones de límites y de conservación de datos varían según el tipo de suscripción:

### A. Registro de Ventas en Versión Demo (3 Días de Historial)
* **Regla**: El comercio bajo el estado `'demo'` conserva únicamente las transacciones correspondientes a los **últimos 3 días con ventas registradas**.
* **Purga en SQLite**: Al ingresar una nueva venta o al arrancar la app, el sistema evalúa la fecha del registro más reciente y ejecuta la limpieza:
  `DELETE FROM sales WHERE created_at < datetime('now', '-3 days')`
  De esta forma, en el día 4 operativo, los registros del día 1 se purgan de la memoria interna, optimizando al máximo el almacenamiento.

### B. Archivado y Retención de Ventas en Versión Premium (90 Días en Local, Historial en la Nube)
* **Regla**: Para evitar que la base de datos interna SQLite se sature o ralentice la búsqueda en el celular, las ventas mayores a **90 días (3 meses)** de antigüedad se archivan y se eliminan de la base de datos principal de SQLite.
* **Proceso de Archivado e Integración Cloud**:
  1. La app agrupa las ventas antiguas por mes (ej. `ventas_2026_05`).
  2. Genera un archivo **CSV estructurado** y autocontenido con los datos de las transacciones y lo almacena localmente en `FileSystem.documentDirectory + 'archivos_ventas/sales_YYYY_MM.csv'`.
  3. **Subida a Supabase Storage**: Sube de forma automática el archivo CSV al bucket privado `tenant-sales-archives` de Supabase bajo la ruta `archives/${tenantId}/sales_${anio}_${mes}.csv`.
  4. Si no hay conexión de red, la subida se añade a `sync_operations` para ejecutarse automáticamente al recuperar señal.
  5. Una vez confirmado el guardado en la nube (o encolado en cola sync), realiza el purgado en SQLite:
     `DELETE FROM sales WHERE created_at < datetime('now', '-90 days')`
  6. **Ecosistema Web**: La consola de administración Web lee los archivos de este bucket privado para permitir al administrador y al comerciante auditar y exportar el historial completo del comercio desde cualquier navegador de escritorio.

### C. Almacenamiento y Sincronización del Logo Comercial en la Nube
* **Subida en Ajustes**: Al cargar el logo del comercio en la pantalla de Ajustes del celular, el archivo se sube asíncronamente al bucket público `tenant-logos` de Supabase Storage (`logos/${tenantId}_logo.png`).
* **Offline Fallback**: Si está offline, se almacena localmente y se añade el evento de carga a `sync_operations`.
* **Uso Multidispositivo**: La URL pública de Supabase del logo se guarda en la base de datos central y en la SQLite local. De esta forma, tanto la app móvil (para el Home y el PDF de etiquetas) como la interfaz de escritorio Web consumen y visualizan siempre el mismo logo corporativo en tiempo real.

### D. Cantidad de Productos en Versión Demo (Límite 20)
* **Condición**: `SELECT COUNT(*) FROM products WHERE tenant_id = $tenantId AND is_active = 1`.
* **Bloqueo**: En el formulario de añadir producto, al presionar "Guardar":
  * Si la cuenta es `'demo'` y el contador de productos es $\ge 20$:
    * Cancela la inserción.
    * Muestra la alerta: *"Límite de productos alcanzado (máx. 20 en versión Demo). Activa la versión completa para agregar productos ilimitados."*

### E. Cantidad de Empleados en Versión Demo (Límite 2)
* **Condición**: `SELECT COUNT(*) FROM users WHERE tenant_id = $tenantId AND is_active = 1`.
* **Bloqueo**: En el panel de gestión de personal, al presionar "Crear Empleado":
  * Si la cuenta es `'demo'` y el contador de empleados es $\ge 2$:
    * Cancela la creación.
    * Muestra la alerta: *"La versión Demo está limitada a 2 empleados. Activa la versión completa para gestionar personal de forma ilimitada."*

---

## 3. Redirección y Activación por WhatsApp

En la pantalla de Ajustes, si la cuenta posee el estado `'demo'` o `'expired'`, se despliega una tarjeta promocional diseñada en consonancia con la temática premium del POS:

* **Mensaje**: *"Estás utilizando la versión Demo. Tu período de prueba expira en X días."*
* **Acción de Activación**: Un botón con el icono de WhatsApp (`logo-whatsapp`) y color de marca verde esmeralda.
* **Integración de Enlace**:
  Al presionarse, el sistema construye y abre el siguiente enlace de API de WhatsApp:
  `https://wa.me/5491132857002?text=Hola!%20Quiero%20activar%20la%20versión%20completa%20de%20mi%20POS.%20Mi%20ID%20de%20Comercio%20es:%20[TENANT_ID]`
  *(Donde `[TENANT_ID]` se reemplaza dinámicamente con el UUID del comercio del usuario actual).*

---

## 4. Consola Global de Administración de Licencias

Para facilitar la renovación manual de licencias sin necesidad de pasarela de cobro integrada, se incluye un panel de control interno oculto en la aplicación móvil:

### A. Mecanismo de Acceso Seguro
1. En la pantalla de **Ajustes**, al final de la sección, habrá un botón discreto: *"Consola Global de Licencias"*.
2. Este botón sólo será visible para usuarios con rol de administrador (`user.role === 'admin'`).
3. Al presionarse, se abrirá un modal flotante pidiendo una **Clave Maestra de Plataforma** (`"ANTIGRAVITY_ADMIN_2026"`).
4. Si la clave coincide, se da acceso a la pantalla `LicenseAdminScreen`.

### B. Funcionalidades del Panel:
* **Buscador**: Permite listar y buscar comercios locales o remotos (mediante consulta Supabase).
* **Ficha del Comercio**:
  * Muestra el ID del Comercio, Nombre comercial, correo del propietario, y estado de licencia actual.
* **Botón "Sumar 30 días de suscripción"**:
  * Toma la fecha actual (o la fecha de vencimiento actual si aún es válida para no recortar días ya pagados) y le suma 30 días en milisegundos.
  * Cambia el estado del comercio a `'active'`.
  * Guarda los metadatos locales en SQLite.
  * Encola una operación en la tabla de sincronización offline (`sync_operations`) para actualizar de forma asíncrona la tabla central de Supabase, asegurando que todos los dispositivos vinculados al comercio reciban la renovación de forma automática al sincronizarse.
* **Botón "Habilitar Licencia Permanente"**:
  * Establece la fecha de expiración a un valor infinito (por ejemplo, año 2100), removiendo permanentemente los límites.

---

## 5. Seguridad de Tiempo Offline y Prevención de Clock Tampering (Anti-Fraude)

Dado que la aplicación funciona principalmente sin conexión y valida la licencia usando la fecha y hora interna del teléfono (`new Date().getTime()`), existe el riesgo de que un usuario intente "burlar" la expiración cambiando manualmente la fecha de su celular hacia atrás en los Ajustes del Sistema Operativo.

Para evitar este fraude, la app implementa la siguiente lógica de seguridad de **Reloj Progresivo Monótono**:

1. **Metadato de Control**: Se crea la clave local `last_known_device_time_${tenantId}` en `app_metadata`.
2. **Registro de Tiempo**: Cada vez que la aplicación se inicia o se guarda un registro de venta exitoso (Checkout), la app guarda el timestamp de ese instante en `last_known_device_time_${tenantId}`.
3. **Verificación de Retroceso**: Antes de autorizar cualquier venta o verificar la licencia, el sistema compara:
   $$\text{Fecha Actual del Dispositivo} < \text{last\_known\_device\_time}$$
4. **Bloqueo**: Si la fecha del dispositivo es menor (es decir, el reloj ha retrocedido hacia el pasado), se presume alteración. El sistema:
   * Bloquea inmediatamente todas las pantallas operativas (Venta, Productos, Empleados).
   * Despliega una alerta modal de seguridad no omitible que exige al usuario activar el ajuste de "Fecha y Hora Automática" para continuar.
