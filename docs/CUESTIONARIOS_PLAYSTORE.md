# Checklist: Cuestionarios de Google Play Store (Ventu POS)

Utiliza este documento como una lista de tareas para completar la configuración obligatoria de Google Play Console (Fase 4). 

---

## 📋 Estado de Cuestionarios

- [x] 1. Política de Privacidad
- [ ] 2. Acceso a la Aplicación
- [ ] 3. Anuncios
- [ ] 4. Clasificación de Contenido
- [ ] 5. Público Objetivo
- [ ] 6. Seguridad de los Datos
- [ ] 7. Apps Gubernamentales
- [ ] 8. Funciones Financieras
- [ ] 9. Salud / Trazabilidad de Contactos
- [ ] 10. Categoría y Detalles de Contacto
- [ ] 11. Ficha de Play Store Principal

---

## 💡 Guía de Respuestas Paso a Paso

A continuación tienes las instrucciones exactas sobre cómo responder cada sección para la app **Ventu**:

### 1. Política de Privacidad
* **Qué hacer:** Google te pide una URL.
* **Respuesta:** Debes colocar una dirección web pública que aloje tus políticas de privacidad.
* *Solución rápida:* Si aún no tienes una web oficial, puedes utilizar un generador gratuito de políticas de privacidad, guardar el texto en un documento público de Google Docs (compartido como "Cualquiera con el enlace puede leer") o subir un archivo HTML simple a un hosting gratuito/GitHub Pages.

### 2. Acceso a la Aplicación
* **Pregunta:** ¿Parte de tu aplicación está restringida por credenciales de inicio de sesión u otras restricciones?
* **Respuesta:** Selecciona **"Algunas funciones o todas están restringidas"** (ya que requiere iniciar sesión con usuario y contraseña).
* **Configuración obligatoria:** Haz clic en **Agregar instrucciones** y provee los siguientes datos:
  * **Nombre de la instrucción:** Acceso de prueba
  * **Usuario / Correo de prueba:** (Escribe un correo de prueba existente en tu Supabase de producción, ej. `test-google@ventu.ar`)
  * **Contraseña:** (La contraseña de esa cuenta de prueba)
  * **Notas / Instrucciones:** *"Iniciar sesión con este usuario y contraseña para acceder al panel principal del POS (Punto de Venta) y probar las funciones de inventario y ventas offline."*

### 3. Anuncios
* **Pregunta:** ¿Tu app contiene anuncios?
* **Respuesta:** Selecciona **"No, mi aplicación no contiene anuncios"**.

### 4. Clasificación de Contenido
* **Qué hacer:** Inicia el cuestionario para obtener la clasificación de edad (ej. PEGI 3 o Apta para todo público).
* **Categoría de la app:** Elige **"Utilidad, productividad, comunicación u otros"**.
* **Preguntas sobre contenido:**
  * ¿Contiene violencia? **No**.
  * ¿Contiene material sexual? **No**.
  * ¿Lenguaje potencialmente ofensivo? **No**.
  * ¿Sustancias controladas? **No**.
  * ¿Permite a los usuarios interactuar o compartir datos? **No** (se refiere a chats abiertos/redes sociales entre usuarios públicos).
  * ¿Comparte la ubicación física con otros usuarios? **No**.
  * ¿Permite comprar bienes digitales? **No** (Ventu es para registrar ventas de tu propio comercio, no compras in-app de Google Play).

### 5. Público Objetivo
* **Rango de edad:** Selecciona únicamente **18 años o más**. 
  * *¿Por qué?* Al ser una herramienta de punto de venta y facturación para comercios, su público es adulto. Al marcar solo mayores de 18 años, evitas que Google aplique estrictas normativas y políticas familiares (COPPA), agilizando drásticamente el proceso de revisión.
* **¿Podría atraer involuntariamente a niños?:** Selecciona **"No"**.

### 6. Seguridad de los Datos (Data Safety)
*Este es el cuestionario más largo. Google requiere saber qué datos de usuario recopila la app.*

* **¿Tu app recopila o comparte datos de usuarios?:** Selecciona **"Sí"**.
* **¿Todos los datos recopilados por la app se cifran en tránsito?:** Selecciona **"Sí"** (todas las conexiones con Supabase y tu API van en HTTPS).
* **¿Ofreces algún método para que los usuarios soliciten la eliminación de sus datos?:** Selecciona **"Sí"** (debes proporcionar una URL o correo donde puedan pedir eliminar la cuenta).
* **Tipos de datos recopilados (marcar los siguientes):**
  1. **Información personal:**
     * *Dirección de correo electrónico* (se recopila para autenticación de usuario).
     * *Nombre* (opcional, para el perfil).
  2. **Información financiera (Opcional):**
     * Al ser un POS, registra transacciones comerciales del negocio, pero **no** datos financieros personales del usuario (tarjetas de crédito, cuentas bancarias). Por lo tanto, puedes marcar **"No"** para datos financieros de personas físicas, o si los consideras parte del negocio, aclara que es para gestión de la cuenta. *Recomendado: No marcar información financiera personal para evitar revisiones extras.*
  3. **Dispositivo u otros identificadores:**
     * *ID de dispositivo* (opcional, si se usa para telemetría o sesiones de seguridad).
* **Para cada dato marcado (ej. Correo electrónico):**
  * ¿Se comparte? **No**.
  * ¿Es obligatorio o el usuario puede elegir? **Obligatorio** (esencial para el login de la cuenta).
  * ¿Para qué se usa? Selecciona **Administración de la cuenta** (Account management).

### 7. Apps Gubernamentales
* **Pregunta:** ¿Tu app representa o pertenece a una entidad del gobierno?
* **Respuesta:** Selecciona **"No"**.

### 8. Funciones Financieras
* **Pregunta:** ¿Tu app ofrece funciones financieras (bancos, préstamos, billeteras de criptomonedas, etc.)?
* **Respuesta:** Selecciona **"No tiene funciones financieras"** (o en su defecto, selecciona la opción que aclare que es solo una herramienta de facturación/punto de venta administrativa si aparece listada, pero generalmente **"No"** es lo adecuado).

### 9. Salud / Trazabilidad de Contactos
* **Pregunta:** ¿Tu app provee servicios relacionados con la salud, COVID-19 o recetas médicas?
* **Respuesta:** Selecciona **"Mi aplicación no es una aplicación de salud"**.

### 10. Categoría y Detalles de Contacto
* **Tipo de app:** **Aplicación**.
* **Categoría:** **Negocios** (Business) o **Productividad** (Productivity).
* **Detalles de contacto:** Coloca un correo electrónico de soporte público (ej. `soporte@ventu.ar`).

### 11. Ficha de Play Store Principal
*Aquí cargas el material de marketing de la app:*
* **Nombre de la app:** Ventu POS
* **Descripción corta:** *"Punto de Venta (POS) rápido y offline para la gestión de tu comercio."* (Máx. 80 caracteres).
* **Descripción completa:** Detalla las características principales:
  * Funcionamiento 100% offline (sin internet).
  * Sincronización automática en la nube.
  * Gestión de stock e inventario.
  * Registro de ventas y cierres de caja.
  * Compatibilidad con impresión de etiquetas/recibos.
* **Activos gráficos:**
  * Sube el icono definitivo (PNG 512x512).
  * Sube el banner promocional (1024x500).
  * Sube capturas de pantalla de la app (mínimo 2 capturas de celular, puedes tomar capturas limpias del emulador).
