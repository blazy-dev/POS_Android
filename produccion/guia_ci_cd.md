# Guía Completa de CI/CD y Gestión de Ambientes (Desarrollo y Producción)

Esta guía explica paso a paso cómo funciona el flujo de desarrollo local y cómo configurar un sistema de **Integración y Despliegue Continuo (CI/CD)** para que, al hacer un simple commit/push en Git, tus aplicaciones (backend y web) se compilen y desplieguen automáticamente en tu VPS de DigitalOcean.

---

## 1. Conceptos Básicos de DevOps (¿Qué herramientas usaremos?)

Si no vienes del mundo de DevOps, estos términos te resultarán familiares pero aquí tienes su función exacta en nuestro flujo:

* **Git / GitHub:** El sistema de control de versiones. Aquí guardas tu código. GitHub será el "cerebro" que detecta cuando subes cambios.
* **GitHub Actions:** Una herramienta de automatización integrada en GitHub. Ejecuta un script (workflow) en la nube cada vez que haces un `git push` a la rama principal (`main`).
* **Docker y Docker Compose:** Crean "contenedores" (cajas aisladas) donde corren tus apps con todas sus dependencias exactas, asegurando que si funciona en tu PC, funcione igual en el VPS.
* **GitHub Container Registry (GHCR):** Un almacén privado en la nube de GitHub donde guardamos las imágenes compiladas de tus aplicaciones (el backend y la web) listas para ser instaladas.
* **SSH (Secure Shell):** El canal seguro y cifrado que utilizará GitHub Actions para conectarse a tu VPS y ordenarle que descargue y corra la nueva versión.

---

## 2. Flujo de Desarrollo Local (Expo y Web)

Para trabajar de forma organizada, mantenemos separados los entornos de **Desarrollo** (tu computadora local) y **Producción** (tu servidor VPS).

### 2.1. Configuración de Entornos

* **App Móvil (Expo):**
  * Para desarrollo local usa: `pos-saas/apps/mobile/.env.development` (apunta a la IP de tu PC y a la base de datos local o de pruebas).
  * Para producción usa: `pos-saas/apps/mobile/.env.production` (apunta a `https://api.ventu.ar/api/v1`).
* **Frontend Web (Next.js):**
  * Localmente lee de `.env.local` (apunta a `http://localhost:3001/api/v1`).
  * En producción lee de `.env.production` (apunta a `https://api.ventu.ar/api/v1`).
* **Backend (NestJS):**
  * Localmente lee de `.env`.
  * En el VPS lee de un archivo persistente y seguro `/srv/pos-saas/.env.production`.

### 2.2. Arrancar el Entorno Local
Para simplificar tu día a día, tienes scripts automatizados en la carpeta `scripts/`. Abre una terminal de PowerShell y ejecuta:

```powershell
# Iniciar todos los servicios (Backend, Web y App de Expo) a la vez en Windows Terminal:
.\scripts\dev-start.ps1

# Detener todos los servicios al terminar tu jornada de desarrollo:
.\scripts\dev-stop.ps1
```

Si vas a probar la app en tu celular físico con **Expo Go**:
1. Asegúrate de estar en la misma red WiFi que tu computadora.
2. Si por temas de router o firewall no conecta, inicia Expo usando el modo túnel:
   ```powershell
   cd pos-saas\apps\mobile
   pnpm run start:tunnel
   ```

---

## 3. Configuración del Despliegue Automático (Git-Based Deploy)

Para lograr que al hacer `git push origin main` todo se actualice solo en tu VPS, seguiremos estos pasos:

### Paso 3.1: Crear el Archivo de Workflow en GitHub
Debes crear un archivo de configuración en tu repositorio en la ruta `.github/workflows/deploy.yml`. 

Este script le dirá a GitHub:
1. "Escucha los push en la rama `main`".
2. "Compila el backend y la web usando sus respectivos Dockerfiles".
3. "Sube esas imágenes compiladas a GHCR".
4. "Conéctate al VPS por SSH".
5. "Ve a `/srv/pos-saas`, descarga las nuevas imágenes y reinicia los contenedores".

A continuación tienes el código que debes colocar en ese archivo:

```yaml
name: Deploy to DigitalOcean VPS

on:
  push:
    branches:
      - main

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # 1. Compilar y subir el Backend
      - name: Build and push Backend image
        uses: docker/build-push-action@v5
        with:
          context: ./pos-saas/backend
          file: ./produccion/backend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/pos-backend:latest

      # 2. Compilar y subir el Frontend Web
      - name: Build and push Web image
        uses: docker/build-push-action@v5
        with:
          context: ./pos-saas/apps/web
          file: ./produccion/frontend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/pos-web:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_IP }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /srv/pos-saas
            # Loguearse a GitHub Registry desde el VPS para poder descargar las imágenes
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            # Descargar las nuevas imágenes compiladas
            docker compose pull
            # Levantar/Reiniciar los contenedores aplicando los cambios sin caída del servicio
            docker compose up -d --remove-orphans
            # Limpiar imágenes viejas que ya no sirven para ahorrar espacio en disco
            docker image prune -f
```

---

### Paso 3.2: Configurar las Credenciales Seguras en GitHub (Secrets)
Para que GitHub pueda conectarse de forma segura a tu servidor VPS, no debemos escribir contraseñas ni IPs en el código. En su lugar, usamos **GitHub Secrets**:

1. Entra a tu repositorio en la página de GitHub.
2. Ve a **Settings** (Configuración) -> **Secrets and variables** -> **Actions**.
3. Haz clic en **New repository secret** y agrega estas tres variables:
   * **`VPS_IP`**: Coloca la dirección IP de tu VPS de DigitalOcean (`107.170.73.166` o tu dominio asociado).
   * **`VPS_USER`**: Coloca el nombre del usuario de despliegue que configuraste (según las guías previas, debería ser `deploy`).
   * **`SSH_PRIVATE_KEY`**: Pega aquí el contenido de tu llave SSH privada local (el archivo `id_rsa` o `id_ed25519` que usas para conectarte al VPS). *Nota: GitHub usará esta llave privada para autenticarse temporalmente ante el VPS en cada deploy.*

---

### Paso 3.3: Adaptar el `docker-compose.yml` en tu VPS
Para que el servidor sepa que ya no tiene que compilar el código desde cero localmente (lo cual consume muchísima RAM/CPU y podría colgar tu VPS), debemos decirle que descargue las imágenes pre-compiladas de GitHub. 

Edita tu archivo `/srv/pos-saas/docker-compose.yml` en el VPS (o prepáralo localmente para subirlo) para que use las imágenes de GHCR en lugar de `build`:

```yaml
version: '3.8'

services:
  nestjs_app:
    # Cambiamos "build" por "image" apuntando a GHCR
    image: ghcr.io/<TU_USUARIO_DE_GITHUB>/pos-backend:latest
    container_name: nestjs_app
    restart: always
    env_file:
      - .env.production
    expose:
      - "3000"
    networks:
      - pos_network

  nextjs_app:
    # Cambiamos "build" por "image" apuntando a GHCR
    image: ghcr.io/<TU_USUARIO_DE_GITHUB>/pos-web:latest
    container_name: nextjs_app
    restart: always
    expose:
      - "3000"
    networks:
      - pos_network

  nginx_proxy:
    image: nginx:alpine
    container_name: nginx_proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot_etc:/etc/letsencrypt:ro
      - ./certbot_var:/var/www/certbot:ro
    depends_on:
      - nestjs_app
      - nextjs_app
    networks:
      - pos_network

  certbot:
    image: certbot/certbot
    container_name: certbot
    volumes:
      - ./certbot_etc:/etc/letsencrypt
      - ./certbot_var:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - pos_network

networks:
  pos_network:
    driver: bridge
```
*(Recuerda reemplazar `<TU_USUARIO_DE_GITHUB>` por tu nombre de usuario real de GitHub en minúsculas).*

---

## 4. Tu nuevo flujo de trabajo diario (Fácil y Rápido)

Una vez configurado todo lo anterior, tu rutina para desarrollar y desplegar será sumamente sencilla:

1. **Paso 1 (Desarrollo):** Escribes código localmente y pruebas usando `.\scripts\dev-start.ps1`.
2. **Paso 2 (Guardar cambios):** Cuando todo ande bien, haces tus commits locales:
   ```bash
   git add .
   git commit -m "Explicación breve del cambio"
   ```
3. **Paso 3 (Despliegue a Producción):** Subes tus cambios a la rama principal:
   ```bash
   git push origin main
   ```
4. **Paso 4 (Verificación):** Automáticamente GitHub Actions compilará la nueva versión y la subirá a tu VPS en segundo plano. En unos 2-3 minutos tu VPS estará corriendo el nuevo código sin que hayas tenido que conectarte por consola ni hacer transferencias manuales.
