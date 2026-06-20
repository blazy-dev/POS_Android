# POS SaaS Android-First — Offline-First

Este es un sistema de Punto de Venta (POS) multiempresa (SaaS) diseñado con un enfoque **Android-First** y **Offline-First**. Permite a pequeños y medianos comercios operar de forma 100% offline y sincronizar automáticamente sus datos en la nube (PostgreSQL) cuando disponen de conexión a internet.

---

## 🚀 Requisitos Previos

Para configurar y ejecutar el proyecto en una nueva computadora, necesitarás instalar las siguientes herramientas globales:

1.  **Git**: Para clonar y gestionar el repositorio.
2.  **Node.js (v18 o superior)**: Entorno de ejecución de JavaScript.
3.  **pnpm** (Recomendado) o **npm**: Gestor de paquetes de Node.
    *   *Para instalar pnpm globalmente:* `npm install -g pnpm`
4.  **Python (3.10 o superior)** y **pip**: Para ejecutar el backend.
5.  **Entorno de desarrollo Android**:
    *   **Expo Go** (App en tu celular físico) para pruebas rápidas sin configurar emuladores, o:
    *   **Android Studio** (con un dispositivo virtual configurado) para depuración avanzada en emulador.

---

## 📂 Estructura del Repositorio

El proyecto está organizado en la siguiente estructura monorepo básica:

```text
pos-saas/
├── apps/
│   └── mobile/              # Aplicación móvil en React Native (Expo)
├── backend/
│   ├── app/                 # Código principal del backend en FastAPI
│   │   ├── api/             # Rutas y endpoints (auth, sync, etc.)
│   │   ├── core/            # Configuraciones y seguridad (JWT)
│   │   ├── db/              # Sesión de base de datos y modelos base
│   │   └── models/          # Modelos de base de datos de SQLAlchemy
│   ├── alembic/             # Carpeta de control de migraciones de base de datos
│   ├── test.db              # Base de datos SQLite (Desarrollo local)
│   └── requirements.txt     # Dependencias de Python
└── docs/                    # Documentación de diseño y arquitectura del proyecto
```

---

## 🛠️ Configuración e Inicialización

Sigue estos pasos en orden para inicializar el proyecto en tu nueva máquina:

### 1. Clonar el Repositorio
Abre tu terminal y ejecuta:
```bash
git clone <URL_DEL_REPOSITORIO>
cd <CARPETA_DEL_PROYECTO>
```

---

### 2. Configurar el Backend (FastAPI + SQLAlchemy)

1.  Ve al directorio del backend:
    ```bash
    cd pos-saas/backend
    ```
2.  Crea un entorno virtual de Python (Opcional pero altamente recomendado):
    ```bash
    python -m venv venv
    # En Windows (PowerShell):
    .\venv\Scripts\Activate.ps1
    # En Windows (CMD):
    venv\Scripts\activate.bat
    # En Mac/Linux:
    source venv/bin/activate
    ```
3.  Instala las dependencias necesarias:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configura las variables de entorno locales:
    *   Copia el archivo `.env.example` y renombralo a `.env`:
        ```bash
        cp .env.example .env
        ```
    *   *Nota:* Para desarrollo local rápido, el archivo `.env` viene configurado para usar una base de datos **SQLite local (`test.db`)**. Si deseas usar **PostgreSQL** para pruebas idénticas a producción, solo debes cambiar la variable `DATABASE_URL` en tu `.env`.
5.  Ejecuta las migraciones de base de datos de **Alembic** para crear las tablas locales:
    ```bash
    alembic upgrade head
    ```
6.  Inicia el servidor backend local con **Uvicorn**:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000
    ```
    *El servidor estará disponible en:* `http://localhost:8000`  
    *Puedes acceder a la documentación interactiva en:* `http://localhost:8000/docs`

---

### 3. Configurar la App Móvil (React Native + Expo)

1.  Abre otra terminal y dirígete a la carpeta de la aplicación móvil:
    ```bash
    cd pos-saas/apps/mobile
    ```
2.  Instala las dependencias del proyecto:
    ```bash
    pnpm install
    # o si usas npm:
    npm install
    ```
3.  **Configurar IP de desarrollo:**  
    Abre el archivo `src/api/client.ts` y asegúrate de configurar `apiConfig.baseUrl` con la dirección adecuada:
    *   Si usas **Emulador Android**: Déjalo en `http://10.0.2.2:8000/api/v1` (dirección especial de loopback del emulador).
    *   Si usas **Dispositivo Físico**: Reemplaza `10.0.2.2` con la **dirección IP local** de tu computadora (ejemplo: `http://192.168.1.50:8000/api/v1`). Ambos dispositivos deben estar conectados al mismo Wi-Fi.
4.  Inicia el servidor de desarrollo de Metro:
    ```bash
    pnpm start --tunnel
    # o si usas npm:
    npm run start -- --tunnel
    ```
5.  **Abrir la app:**
    *   **Celular físico:** Abre la app **Expo Go** en tu celular y escanea el código QR que se muestra en tu terminal.
    *   **Emulador:** Presiona la tecla `a` en tu terminal para abrir la app automáticamente en el emulador de Android configurado.

---

## 🔄 Funcionamiento de la Sincronización en Desarrollo

*   **Offline-First:** Todas las ventas, movimientos de stock y aperturas de caja se guardan primero en la base de datos SQLite interna de tu dispositivo (`pos_local.db`).
*   **Autenticación en desarrollo:** Para facilitar las pruebas, el cliente móvil realiza automáticamente un inicio de sesión silencioso simulado (usando un `test-token` semilla). El backend registrará automáticamente al usuario y le creará su respectivo Tenant de prueba `test@comercio.com` si no existiera.
*   **Sincronización:** Dirígete al módulo de **Sincronización** en el menú de la app móvil para forzar un PUSH (subir ventas y cambios locales) o PULL (descargar productos agregados en el backend).

---

## 📖 Documentación Relacionada
Para mayor detalle sobre el diseño del sistema, revisa la carpeta `/docs`:
*   [Roadmap del Proyecto](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/docs/ROADMAP.md)
*   [Especificación detallada de la API](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/docs/API_SPEC.md)
*   [Esquema de Base de Datos Global](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/docs/DATABASE_SCHEMA.md)
*   [Estrategia de Sincronización Offline-First](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/docs/SYNC_STRATEGY.md)
