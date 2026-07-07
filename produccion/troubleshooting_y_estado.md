# Estado de Infraestructura y Guía de Resolución de Problemas (Troubleshooting)

Este documento resume el estado actual del despliegue del backend en la etapa **Beta** dentro de **DigitalOcean** y recopila las soluciones a los errores técnicos específicos que surgieron durante el aprovisionamiento para futuras referencias rápidas.

---

## 1. Estado Actual de la Infraestructura

* **Servidor**: VPS (Droplet) de DigitalOcean con IP pública `107.170.73.166` corriendo Ubuntu 24.04 LTS.
* **Seguridad**: UFW interno desactivado (administrado externamente a través de **DigitalOcean Cloud Firewall** para proteger los puertos a nivel de red).
* **Orquestación**: Docker y Docker Compose activos.
* **Contenedores**:
  * `nestjs_app`: Levanta NestJS en el puerto `3000`. Conectado a Supabase.
  * `nginx_proxy`: Escucha en el puerto `80` (HTTP) de la IP pública y redirige el tráfico al puerto 3000 de la app.
* **Prefijo API**: Toda la API responde bajo el prefijo `/api/v1` (ej: `http://107.170.73.166/api/v1/health` responde `{"status":"ok"}`).

---

## 2. Historial de Errores Específicos y Soluciones

### Error 2.1. Certbot falló con `NXDOMAIN`
* **Síntoma**:
  ```text
  Detail: DNS problem: NXDOMAIN looking up A for api.comerciopos.com
  Some challenges have failed.
  ```
* **Causa**: Intentar generar un certificado de Let's Encrypt para un dominio que no está registrado o que no tiene un registro **Tipo A** apuntando a la IP pública del servidor VPS en el proveedor de DNS.
* **Solución**:
  1. Para pruebas rápidas iniciales, se deshabilita temporalmente Certbot y se expone el puerto `80` directamente sobre HTTP.
  2. Una vez que el dominio (ej. delegando en NIC Argentina / DonWeb) esté activo, se debe apuntar el registro **Tipo A** a la IP del servidor y seguir la **Sección 6** de la `guia_VPS.md` para migrar a HTTPS de forma definitiva.

### Error 2.2. Contexto de Docker no encontrado (`path "/pos-saas/backend" not found`)
* **Síntoma**:
  ```text
  unable to prepare context: path "/pos-saas/backend" not found
  ```
* **Causa**: El archivo `docker-compose.yml` hacía referencia a una ruta local de desarrollo. En el VPS solo se habían subido los archivos de configuración y no el código fuente del backend.
* **Solución**:
  1. Se modificó el `context` en `docker-compose.yml` a `./backend`.
  2. Se subió la carpeta del código fuente NestJS (`/pos-saas/backend`) desde la PC local a `/srv/pos-saas/backend` en el VPS.
  3. Para acelerar la transferencia y evitar subir miles de archivos innecesarios de `node_modules`, se comprime en un `.tar.gz` excluyendo `node_modules`, se sube en 1 segundo y se descomprime en el Droplet:
     ```powershell
     tar --exclude="node_modules" -czf backend.tar.gz -C ./pos-saas backend
     scp backend.tar.gz deploy@<IP>:/srv/pos-saas/
     # En el VPS:
     tar -xzf backend.tar.gz
     ```

### Error 2.3. Copia conflictiva de `node_modules` en la compilación
* **Síntoma**:
  ```text
  failed to solve: cannot copy to non-directory: .../node_modules/ajv
  ```
* **Causa**: Al realizar la directiva `COPY . .` en el Dockerfile, los residuos o enlaces rotos de la carpeta `node_modules` local del host sobreescribían los directorios de dependencias limpios creados dentro del contenedor por `pnpm install`.
* **Solución**:
  1. Se borraron los residuos de `node_modules` local en el VPS (`rm -rf backend/node_modules`).
  2. Se agregó un archivo `.dockerignore` dentro de la carpeta `backend/` en el Droplet con la regla para excluir `node_modules` y `dist` de la compilación de la imagen.

### Error 2.4. NestJS crasheaba con `MODULE_NOT_FOUND`
* **Síntoma**:
  ```text
  Error: Cannot find module '/usr/src/app/dist/main'
  ```
* **Causa**: NestJS compila por defecto preservando la estructura del código, ubicando el archivo resultante en `dist/src/main.js` en lugar de `dist/main.js`.
* **Solución**: Se actualizó la directiva `CMD` en el `Dockerfile` de producción para que identifique dinámicamente el entrypoint correcto y arranque el proceso de Node de forma segura:
  ```dockerfile
  CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
  ```

### Error 2.5. Nginx crasheaba con `host not found in upstream "nestjs_app"`
* **Síntoma**:
  ```text
  [emerg] 1#1: host not found in upstream "nestjs_app" in /etc/nginx/conf.d/default.conf:46
  ```
* **Causa**: Como NestJS crasheaba inmediatamente (por el error 2.4), Nginx no podía resolver la dirección de red del contenedor de NestJS al iniciar, por lo que abortaba con error fatal y entraba en un ciclo de reinicio infinito.
* **Solución**: Al reparar el inicio del backend NestJS (Error 2.4) y reiniciar Nginx con `docker compose restart nginx_proxy`, Nginx pudo resolver el hostname correctamente y levantó con éxito.

### Error 2.6. Sincronización fallaba con error `503` (Prisma DATABASE_URL faltante)
* **Síntoma**:
  ```text
  ERROR [SYNC] Error: Server responded with 503
  ```
* **Causa**: En el archivo de variables de entorno de producción `.env.production` faltaba definir la variable de conexión `DATABASE_URL` requerida por el esquema de Prisma. Al no tenerla, Prisma fallaba al conectar a PostgreSQL y NestJS respondía con un error interno de base de datos no disponible.
* **Solución**: Se obtuvo la URI de conexión a base de datos de PostgreSQL desde la configuración de Supabase y se añadió al archivo `.env.production` en el Droplet:
  ```text
  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
  ```

### Error 2.7. Prisma fallaba en Alpine con `Prisma Client could not locate the Query Engine for runtime "linux-musl-openssl-3.0.x"`
* **Síntoma**:
  ```text
  Prisma Client could not locate the Query Engine for runtime "linux-musl-openssl-3.0.x".
  This happened because Prisma Client was generated for "linux-musl", but the actual deployment required "linux-musl-openssl-3.0.x".
  ```
* **Causa**: Las imágenes de Node Alpine v20 utilizan OpenSSL 3.0.x. Prisma requiere compilar sus motores nativos compatibles para esta distribución.
* **Solución**:
  1. Se modificó el bloque generator de `schema.prisma` local para indicarle explícitamente el binaryTarget requerido:
     ```prisma
     generator client {
       provider      = "prisma-client-js"
       binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
     }
     ```
  2. Se añadieron las dependencias de sistema `openssl` y `libc6-compat` en el Estadio 2 del `Dockerfile`.
  3. Se empaquetó, subió y reconstruyó la imagen Docker de NestJS en el servidor.

---

### Error 2.8. Certbot falló con `SERVFAIL` durante la delegación de DNS
* **Síntoma**:
  ```text
  DNS problem: SERVFAIL looking up A for api.ventu.ar - the domain's nameservers may be malfunctioning
  ```
* **Causa**: Al realizar el cambio de Nameservers de DonWeb hacia DigitalOcean, NIC Argentina tarda varias horas en propagar la delegación en los servidores raíz. Los servidores DNS intermedios entran en un estado transitorio donde no saben a quién preguntar y devuelven `SERVFAIL`.
* **Solución**:
  1. Consultar de manera directa a los servidores autoritativos para diagnosticar el estado real (`nslookup api.ventu.ar ns3.hostmar.com` y `nslookup api.ventu.ar ns1.digitalocean.com`).
  2. Agregar temporalmente el registro `A` de `api` en la zona DNS vieja (DonWeb) para habilitar la respuesta instantánea del dominio mientras la delegación a DigitalOcean termina de propagarse globalmente.

### Error 2.9. Subdominio apunta a nombre duplicado en DigitalOcean
* **Síntoma**: El subdominio `api.ventu.ar` no resolvía, pero sí lo hacía `api.ventu.ar.ventu.ar`.
* **Causa**: En el panel de DNS de DigitalOcean, el campo de entrada "Hostname" autocompleta con el dominio raíz. Escribir el dominio completo (`api.ventu.ar`) duplica el sufijo.
* **Solución**: Escribir únicamente el subdominio (`api` para la API o `@` para la raíz) en el campo "Hostname".

### Error 2.10. Compilación Docker abortada con `signal: killed` (Out of Memory)
* **Síntoma**:
  ```text
  failed to execute bake: signal: killed
  ```
* **Causa**: El proceso de instalación de dependencias de pnpm y compilación de Next.js (`next build`) superó el límite de memoria física (1 GB RAM) del Droplet de DigitalOcean, forzando al kernel de Linux a matar el proceso de Docker (OOM Killer).
* **Solución**: Configurar 2 GB de memoria de intercambio (Swap) en el VPS para proveer RAM virtual al sistema:
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

### Error 2.11. Compilación de Next.js falló con `Cannot find module 'vitest'` o `@vitejs/plugin-react`
* **Síntoma**:
  ```text
  Type error: Cannot find module 'vitest' or its corresponding type declarations.
  Type error: Cannot find module '@vitejs/plugin-react' or its corresponding type declarations.
  ```
* **Causa**: Al empaquetar y subir únicamente el subdirectorio de la aplicación `web` (`/pos-saas/apps/web`), el compilador no tenía acceso a las dependencias de desarrollo y test definidas en el archivo `package.json` de la carpeta padre del monorepo (`/pos-saas/apps/package.json`).
* **Solución**:
  1. Mapear explícitamente las dependencias requeridas para la compilación (`vitest`, `jsdom`, `@vitejs/plugin-react`, `@testing-library/*`) dentro del campo `devDependencies` de la app frontend en [package.json](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/pos-saas/apps/web/package.json).
  2. Ajustar el `Dockerfile` del frontend para instalar usando el flag `--no-frozen-lockfile` ya que el archivo lockfile local no contenía la sincronización de estas nuevas dependencias.

### Error 2.12. Nginx no inicia con error `cannot load certificate ... No such file or directory`
* **Síntoma**: El contenedor `nginx_proxy` entra en ciclo infinito de reinicio mostrando en logs:
  ```text
  cannot load certificate "/etc/letsencrypt/live/ventu.ar/fullchain.pem": BIO_new_file() failed ... No such file or directory
  ```
* **Causa**: El comando de Certbot standalone utilizó un montaje físico del disco del host (`/srv/pos-saas/certbot_etc`), mientras que `docker-compose.yml` montaba un volumen nombrado virtual de Docker (`certbot_etc`). Al estar el volumen virtual vacío, Nginx no tenía acceso a los certificados reales guardados en el disco.
* **Solución**: Actualizar `docker-compose.yml` para reemplazar el volumen nombrado virtual por montajes de carpetas locales reales del host (`./certbot_etc` y `./certbot_var`).


