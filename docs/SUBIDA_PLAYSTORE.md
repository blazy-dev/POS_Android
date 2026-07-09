# Guía de Subida a Google Play Store (Ventu Mobile)

Esta guía detalla el proceso completo para preparar, compilar en formato **AAB (Android App Bundle)** y publicar la aplicación móvil en la tienda oficial de Google Play Store utilizando las herramientas de **Expo** y **EAS (Expo Application Services)**.

---

## 📋 Fase 1: Requisitos Previos

### 1.1. Cuenta de Desarrollador de Google Play
* Regístrate en [Google Play Console](https://play.google.com/console).
* Requiere un pago único de **USD $25**.
* Ten a mano un documento de identidad para verificar tu cuenta (Google suele tardar de 1 a 2 días hábiles en verificarla).

### 1.2. Verificar `app.json`
Asegúrate de que los campos clave en `pos-saas/apps/mobile/app.json` estén correctamente configurados antes de compilar:
* **Package/Bundle Identifier:** Debe ser único y definitivo. Actualmente está configurado como:
  ```json
  "package": "com.ventupos.mobile"
  ```
* **Nombre de la App:** `"name": "Ventu"` (o el nombre definitivo para mostrar en el dispositivo).

---

## 🛠️ Fase 2: Compilar el Paquete de Producción (AAB)

> [!IMPORTANT]
> Google Play Store ya no acepta archivos APK para la publicación inicial de aplicaciones; exige el formato **AAB (Android App Bundle)**, que es más seguro y genera descargas optimizadas y más livianas para los usuarios.

### 2.1. Configurar el Perfil de Producción
Asegúrate de que tu archivo `eas.json` (en la raíz del proyecto mobile `pos-saas/apps/mobile/eas.json`) tenga configurado el perfil de `production` para distribución oficial:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://dukyedgoyshhtjkuphow.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_VqVvijnn9uzhCjaAUJgvaw_FqZ_2jyA",
    "EXPO_PUBLIC_API_URL": "https://api.ventu.ar/api/v1"
  }
}
```

### 2.2. Ejecutar la Compilación en Producción
Abre una terminal, navega a la carpeta de la aplicación móvil y ejecuta la compilación en EAS:

```powershell
cd pos-saas/apps/mobile
eas build --platform android --profile production
```
*(También puedes usar el script automatizado `pnpm run build:android` en caso de que esté completamente integrado en tu flujo de ambientes).*

### 2.3. Guardar las Credenciales (Keystore)
* Durante el primer build, EAS te preguntará: `"Do you want us to generate a new Android KeyStore?"`
* Selecciona **Yes** (Sí).
* Expo gestionará la clave de firma de tu app de forma segura en sus servidores para futuras compilaciones.

### 2.4. Descargar el archivo AAB
Al terminar la compilación con éxito, la terminal de EAS te proporcionará un enlace de descarga del archivo con extensión `.aab` (por ejemplo, `app-release.aab`). Descárgalo localmente en tu computadora.

---

## 🌐 Fase 3: Crear la Ficha en Google Play Console

1. Inicia sesión en [Google Play Console](https://play.google.com/console).
2. Haz clic en **Crear aplicación** (Create app).
3. Rellena los datos básicos iniciales:
   * **Nombre de la app:** Ventu POS (o el nombre público que elijas).
   * **Idioma predeterminado:** Español (u otro idioma predeterminado de tu región).
   * **Tipo:** Aplicación.
   * **Precio:** Gratis. *(Nota: Si inicias de pago no podrás cambiarla a gratuita de forma sencilla, pero si la inicias gratis siempre podrás monetizar mediante suscripciones o compras dentro de la app).*
   * **Declaraciones:** Acepta las políticas del programa y leyes de exportación de EE.UU.

---

## 📝 Fase 4: Configurar la Ficha de Tienda y Cuestionarios

Antes de poder subir y enviar a revisión el archivo `.aab`, Google exige configurar una serie de secciones obligatorias:

* **Política de Privacidad:** Debes proveer un enlace (URL) público con tu política de privacidad.
* **Acceso a la aplicación:** Si tu app requiere credenciales (usuario y contraseña) para iniciar sesión, debes proveer una cuenta de demostración funcional para que los revisores de Google puedan probarla.
* **Anuncios:** Declarar si tu aplicación contiene anuncios (seleccionar **No**).
* **Clasificación de contenido:** Rellenar el cuestionario para determinar la edad recomendada de la app (generalmente apta para todo público en herramientas comerciales).
* **Público objetivo:** Selecciona el rango de edad de tus usuarios (por ejemplo, mayores de 18 años / comercios).
* **Ficha de Play Store Principal:**
  * **Descripción corta:** Breve resumen (máx. 80 caracteres).
  * **Descripción completa:** Explicación detallada de las funciones y beneficios del POS (máx. 4000 caracteres).
  * **Gráficos obligatorios:**
    * Icono de la app (512x512 px, PNG de 32 bits).
    * Gráfico de funciones / Banner de portada (1024x500 px, JPG o PNG de 24 bits).
    * Capturas de pantalla del teléfono (mínimo 2 capturas, relación de aspecto 16:9 o 9:16).
    * Capturas de pantalla de tablets de 7" y 10" (muy recomendado para aplicaciones de tipo POS).

---

## 🧪 Fase 5: Pruebas Cerradas (Requisito Obligatorio)

> [!WARNING]
> **Regla de Cuentas Nuevas (2024+):** Si tu cuenta de desarrollador de Google Play es de tipo **personal** y fue creada después de **noviembre de 2023**, Google exige obligatoriamente realizar una **Prueba Cerrada (Closed Testing)** con un mínimo de **20 probadores distintos** que mantengan instalada la app durante **14 días seguidos** antes de permitirte habilitar el canal de producción (público).

1. En el menú izquierdo de Google Play Console, ve a **Pruebas cerradas** (Closed testing).
2. Crea una nueva versión (Release) y sube tu archivo `.aab` descargado en la **Fase 2**.
3. Configura la lista de correos de tus 20 probadores.
4. Envía la versión a revisión. La primera revisión de Google suele tardar de **3 a 7 días hábiles**.
5. Cuando sea aprobada, tus probadores deberán descargar la app mediante el enlace de descarga que te proporcionará la consola y mantenerla activa en sus dispositivos por **14 días**.

---

## 🚀 Fase 6: Lanzamiento a Producción

1. Una vez superado el período de pruebas cerradas de 14 días y cumplidos los requisitos, se habilitará el botón **Solicitar acceso a producción** en tu consola.
2. Tras la aprobación final de Google, podrás ir a la pestaña **Producción** (Production), crear una nueva versión seleccionando el mismo archivo `.aab` y publicarla para que esté disponible públicamente para todos los usuarios en la tienda oficial.
