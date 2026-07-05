# Manual de Gestión de Ambientes (Desarrollo vs Producción)

Para poder desarrollar localmente de manera ágil sin alterar ni editar manualmente las configuraciones de producción/Beta en la aplicación móvil de Expo y el backend, implementaremos la estrategia de **archivos de entorno segregados**.

---

## 1. Estructura de Archivos `.env` en la App Móvil

En la raíz del proyecto móvil (`/pos-saas/apps/mobile/`), mantendremos dos archivos de configuración de variables de entorno:

### 1.1. Archivo para Desarrollo Local (`.env.development`)
```text
EXPO_PUBLIC_SUPABASE_URL=https://dukyedgoyshhtjkuphow.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VqVvijnn9uzhCjaAUJgvaw_FqZ_2jyA

# URL de tu PC local / emulador
EXPO_PUBLIC_API_URL=http://192.168.0.10:3001/api/v1
```

### 1.2. Archivo para Producción / Beta (`.env.production`)
```text
EXPO_PUBLIC_SUPABASE_URL=https://dukyedgoyshhtjkuphow.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VqVvijnn9uzhCjaAUJgvaw_FqZ_2jyA

# URL pública de tu Droplet en DigitalOcean
EXPO_PUBLIC_API_URL=http://107.170.73.166/api/v1
```

---

## 2. Automatización del Cambio de Ambientes (package.json)

Para evitar renombrar los archivos manualmente y correr el riesgo de subir credenciales erróneas, configuraremos scripts de automatización en el archivo `package.json` de tu aplicación móvil:

### 2.1. Configuración de Scripts en `package.json`:
```json
"scripts": {
  "start:dev": "copy .env.development .env && npx expo start --clear",
  "start:prod": "copy .env.production .env && npx expo start --clear",
  "build:android": "copy .env.production .env && eas build --platform android",
  "build:ios": "copy .env.production .env && eas build --platform ios"
}
```
*(Nota: El comando `copy` funciona en Windows. Para que sea multiplataforma compatible con macOS/Linux en el futuro o pipelines de integración, se puede usar `cp` o el paquete ligero `shx` escribiendo `npx shx cp .env.development .env`)*.

### 2.2. Cómo ejecutar los entornos:

* **Para desarrollar localmente**:
  ```bash
  pnpm run start:dev
  ```
  *(Copia automáticamente tu IP local al archivo `.env` y limpia la caché de empaquetado de Expo).*

* **Para probar la versión Beta en producción**:
  ```bash
  pnpm run start:prod
  ```
  *(Copia automáticamente la IP pública de DigitalOcean al archivo `.env` y limpia la caché de empaquetado de Expo).*

---

## 3. Manejo de Ambientes en el Backend (NestJS)

En el backend NestJS (`/pos-saas/backend/`), mantenemos la misma lógica utilizando el archivo de configuración correspondiente en cada entorno:

* **Desarrollo Local**: NestJS corre leyendo el archivo `.env` (que apunta a Supabase de desarrollo / puerto local).
* **Producción Droplet**: Docker Compose levanta NestJS leyendo de forma aislada y exclusiva el archivo `.env.production` (que contiene la cadena de conexión real `DATABASE_URL` y variables del servidor).
* Al hacer un despliegue de cambios al servidor, el archivo `.env.production` se queda inalterado en `/srv/pos-saas/.env.production` garantizando que no haya ninguna colisión por actualizaciones de código.
