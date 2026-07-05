# Procedimiento de Integración de Dominio y SSL (HTTPS)

Este procedimiento detalla los pasos a seguir una vez que tu dominio registrado en DonWeb (vía NIC Argentina) esté aprobado y listo para ser delegado.

---

## Paso 1: Delegación del Dominio y Registros DNS

Para asociar tu dominio a la dirección IP pública del Droplet de DigitalOcean (`107.170.73.166`):

1. **Configurar Nameservers (Delegación)**:
   * En tu panel de DonWeb / NIC Argentina, configura los Nameservers de **DigitalOcean** para administrar los registros DNS desde el panel de DigitalOcean (Recomendado):
     * `ns1.digitalocean.com`
     * `ns2.digitalocean.com`
     * `ns3.digitalocean.com`
2. **Agregar el Dominio en DigitalOcean**:
   * Ve a **Networking -> Domains** en el panel de DigitalOcean.
   * Añade tu dominio (ej. `comerciopos.com`).
3. **Crear Registro Tipo A**:
   * Crea un registro **Tipo A** para tu subdominio de API (ej. `api.comerciopos.com`):
     * **Type**: `A`
     * **Hostname**: `api`
     * **Value (Will direct to)**: Selecciona tu Droplet (`107.170.73.166`).
     * **TTL**: `3600` (1 hora).
4. **Verificar la propagación**:
   * Abre una terminal local en tu computadora y corre:
     ```bash
     ping api.tudominio.com
     ```
   * Si responde con la IP `107.170.73.166`, el dominio está listo para el siguiente paso.

---

## Paso 2: Generación del Certificado SSL (Let's Encrypt)

Conéctate vía SSH al Droplet y ejecuta los siguientes comandos:

```bash
cd /srv/pos-saas

# 1. Apagar Nginx temporalmente para liberar el puerto 80
docker compose down

# 2. Solicitar el certificado SSL a Let's Encrypt (Reemplaza con tu dominio y mail reales)
sudo docker run -it --rm --name certbot \
  -v "/srv/pos-saas/certbot_etc:/etc/letsencrypt" \
  -v "/srv/pos-saas/certbot_var:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d api.tudominio.com \
  --email tu-correo@gmail.com \
  --agree-tos --no-eff-email

# 3. Confirmar que los certificados se crearon en /srv/pos-saas/certbot_etc/live/
```

---

## Paso 3: Actualizar Configuración a Modo HTTPS en el Droplet

### 3.1. Reemplazar `nginx.conf` por la versión SSL
Abre y edita el archivo en el Droplet:
```bash
nano /srv/pos-saas/nginx.conf
```
Reemplaza todo el contenido por la configuración SSL (reemplazando `api.tudominio.com` por tu subdominio real en las **líneas 4, 13, 17 y 18**):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.tudominio.com;

    # Redirección permanente HTTP -> HTTPS
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
    server_name api.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/api.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominio.com/privkey.pem;

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

### 3.2. Actualizar `docker-compose.yml` para habilitar el puerto 443 y Certbot
Edita el archivo en el Droplet:
```bash
nano /srv/pos-saas/docker-compose.yml
```
Modifica el archivo para habilitar el puerto 443, los volúmenes del certificado SSL y descomenta el servicio de Certbot para la autorenovación de certificados:

```yaml
version: '3.8'

services:
  nestjs_app:
    build:
      context: ./backend
      dockerfile: ./Dockerfile
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
      - "443:443" # Habilitar HTTPS
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

---

## Paso 4: Levantar la API en Modo Seguro

Inicia todos los contenedores en el Droplet:
```bash
docker compose up -d --build
```

### 4.1. Verificación
Abre en tu navegador:
`https://api.tudominio.com/api/v1/health`
*(Debería mostrar la conexión HTTPS segura con el candado verde activo).*
