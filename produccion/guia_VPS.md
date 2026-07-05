# Guía de Configuración y Despliegue en DigitalOcean Droplet (Fase 2 - Modo HTTP)

Esta guía describe el paso a paso detallado para configurar, securizar y desplegar el backend en producción por **HTTP plano** (usando la dirección IP) en tu Droplet de **DigitalOcean**, incluyendo al final las instrucciones para habilitar **HTTPS (SSL)** cuando tu dominio esté listo.

---

## 1. Configuración Inicial en la Consola de DigitalOcean

### 1.1. Crear el Droplet
1. Seleccioná **Create -> Droplets** en tu panel de DigitalOcean.
2. Elegí **Ubuntu 24.04 LTS** como distribución de sistema operativo.
3. Elegí un plan adecuado (ej. Premium AMD/Intel de $6/mes o $12/mes).
4. En **Authentication**, seleccioná **SSH Keys** y subí tu llave SSH pública.
5. Completá el proceso de creación.

### 1.2. Configurar el Cloud Firewall en DigitalOcean
1. Andá a **Networking -> Firewalls -> Create Firewall**.
2. Configura las siguientes reglas de **Inbound Rules** (Entrada):
   * **SSH** (Puerto `22`): Permitido desde tu IP o "All IPv4".
   * **HTTP** (Puerto `80`): Permitido desde "All IPv4" y "All IPv6" (Requerido para consumir la API por HTTP y para el posterior challenge de Let's Encrypt).
3. Deja las **Outbound Rules** (Salida) por defecto (permitir todo).
4. En **Apply to Droplets**, selecciona el nombre del Droplet.
5. Haz clic en **Create Firewall**.

---

## 2. Conexión Inicial y Hardening del Servidor

Conéctate al Droplet como `root` usando tu llave SSH:
```bash
ssh root@<IP_DEL_DROPLET_DIGITALOCEAN>
```

### 2.1. Actualizar el Sistema
```bash
apt update && apt upgrade -y
```

### 2.2. Crear el Usuario de Despliegue (`deploy`)
```bash
adduser deploy
usermod -aG sudo deploy
```

### 2.3. Configurar Acceso SSH para el Usuario `deploy`
```bash
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Prueba la conexión desde tu computadora local:
```bash
ssh deploy@<IP_DEL_DROPLET_DIGITALOCEAN>
```

### 2.4. Deshabilitar Login por Contraseña y Acceso de Root
Edita la configuración del daemon de SSH:
```bash
sudo nano /etc/ssh/sshd_config
```
Modifica o añade las líneas:
```text
PermitRootLogin no
PasswordAuthentication no
```
Reinicia el servicio SSH:
```bash
sudo systemctl restart ssh
```

---

## 3. Instalar Docker y Docker Compose

En la sesión de tu usuario `deploy`, ejecuta los comandos para instalar Docker oficial:

```bash
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y
```

### 3.1. Añadir el Usuario al Grupo de Docker
```bash
sudo usermod -aG docker deploy
```
*Cierra la sesión SSH y vuelve a conectarte para actualizar los grupos.*

---

## 4. Despliegue de Archivos y Configuración

### 4.1. Crear Carpeta de la Aplicación en el Droplet
```bash
sudo mkdir -p /srv/pos-saas
sudo chown -R deploy:deploy /srv/pos-saas
cd /srv/pos-saas
```

### 4.2. Transferir Archivos desde tu Computadora Local
Desde la carpeta raíz de tu proyecto local, envía tanto la configuración de producción como la carpeta que contiene el código fuente de tu backend NestJS:

```bash
# 1. Enviar el Dockerfile, docker-compose.yml y nginx.conf a la carpeta raíz de la app
scp ./produccion/backend/* deploy@<IP_DEL_DROPLET_DIGITALOCEAN>:/srv/pos-saas/

# 2. Enviar la carpeta completa del backend (código fuente)
scp -r ./pos-saas/backend deploy@<IP_DEL_DROPLET_DIGITALOCEAN>:/srv/pos-saas/
```

### 4.3. Crear Variables de Entorno de Producción (`.env.production`)
En el Droplet, crea el archivo de configuración:
```bash
nano /srv/pos-saas/.env.production
```
Define las variables con las credenciales de tu base de datos y Auth de Supabase (Prisma necesita obligatoriamente DATABASE_URL para conectarse a PostgreSQL):
```text
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://postgres:<CONTRASEÑA>@db.<ID_PROYECTO_SUPABASE>.supabase.co:5432/postgres?pgbouncer=true
SUPABASE_URL=https://<TU_PROYECTO_SUPABASE>.supabase.co
SUPABASE_KEY=<TU_SUPABASE_SERVICE_ROLE_KEY>
JWT_SECRET=<TU_JWT_SECRET_SEGURO>
```

---

## 5. Arrancar la Aplicación (Modo HTTP Temporal)

Arranca la aplicación y el proxy Nginx en segundo plano:
```bash
cd /srv/pos-saas
docker compose up -d --build
```

Comprueba que el backend esté respondiendo de forma pública abriendo en tu navegador local o Postman:
`http://<IP_DEL_DROPLET_DIGITALOCEAN>/health`

---

## 6. Transición a HTTPS (SSL) con Let's Encrypt (Una vez delegado tu dominio)

Cuando el dominio que registraste esté delegado y apunte a la IP de tu Droplet de DigitalOcean, sigue estos pasos para migrar a HTTPS:

### Paso 6.1. Obtener el Certificado SSL
Corre Certbot en modo standalone. (Esto requiere detener temporalmente el contenedor de Nginx para liberar el puerto 80):

```bash
# 1. Detener los contenedores temporalmente
docker compose down

# 2. Correr Certbot standalone para generar certificados (Reemplaza por tu dominio y mail reales)
sudo docker run -it --rm --name certbot \
  -v "/srv/pos-saas/certbot_etc:/etc/letsencrypt" \
  -v "/srv/pos-saas/certbot_var:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d api.tudominitoreal.com \
  --email tu-correo@gmail.com \
  --agree-tos --no-eff-email

# 3. Confirmar que se generaron en /srv/pos-saas/certbot_etc/live/
```

### Paso 6.2. Actualizar `nginx.conf` con SSL
Edita tu `/srv/pos-saas/nginx.conf` en el Droplet:
```bash
nano /srv/pos-saas/nginx.conf
```
Reemplaza todo el contenido por la configuración SSL (cambiando `api.tudominitoreal.com` por tu dominio real):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.tudominitoreal.com;

    location / {
        return 301 https://$host$request_uri;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name api.tudominitoreal.com;

    ssl_certificate /etc/letsencrypt/live/api.tudominitoreal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominitoreal.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

    client_max_body_size 10M;

    location / {
        proxy_pass http://nestjs_app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### Paso 6.3. Actualizar `docker-compose.yml` para SSL
Edita tu `/srv/pos-saas/docker-compose.yml` en el Droplet:
```bash
nano /srv/pos-saas/docker-compose.yml
```
Descomenta el servicio de `certbot` y vuelve a mapear el puerto 443 y los volúmenes del certificado SSL:

```yaml
version: '3.8'

services:
  nestjs_app:
    build:
      context: ../../pos-saas/backend
      dockerfile: ../../produccion/backend/Dockerfile
    container_name: nestjs_app
    restart: always
    env_file:
      - .env.production
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
      - "443:443" # Habilitar puerto 443 para HTTPS
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot_etc:/etc/letsencrypt:ro
      - certbot_var:/var/www/certbot:ro
    depends_on:
      - nestjs_app
    networks:
      - pos_network

  certbot:
    image: certbot/certbot
    container_name: certbot
    volumes:
      - certbot_etc:/etc/letsencrypt
      - certbot_var:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - pos_network

volumes:
  certbot_etc:
  certbot_var:

networks:
  pos_network:
    driver: bridge
```

### Paso 6.4. Iniciar todo en Modo SSL
```bash
docker compose up -d --build
```
¡Listo! La API responderá por HTTPS seguro y renovará el certificado automáticamente de forma transparente en el fondo.
