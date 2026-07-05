# --- ESTADIO 1: Compilación ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Instalar dependencias necesarias para compilar paquetes nativos si los hubiera
RUN apk add --no-cache python3 make g++

# Copiar archivos de configuración de dependencias
COPY package*.json pnpm-lock.yaml* ./

# Instalar pnpm globalmente e instalar todas las dependencias
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar el código fuente del backend
COPY . .

# Generar el cliente de Prisma basado en el schema
RUN npx prisma generate

# Compilar la aplicación NestJS
RUN pnpm build

# Eliminar dependencias de desarrollo para quedarse solo con producción
RUN pnpm prune --prod

# --- ESTADIO 2: Ejecución ---
FROM node:20-alpine

# Instalar librerías de compatibilidad necesarias para el motor de Prisma (Query Engine)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

# Variables de entorno por defecto para producción
ENV NODE_ENV=production

# Copiar binarios y código compilado desde el builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Usar usuario seguro sin privilegios de root nativos de Node
USER node

# Exponer el puerto del servidor NestJS
EXPOSE 3000

# Arrancar la aplicación buscando dinámicamente el entrypoint
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
