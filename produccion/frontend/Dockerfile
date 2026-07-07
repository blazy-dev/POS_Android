# Estadio 1: Compilación
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile
COPY . .
ENV NEXT_PUBLIC_API_URL=https://api.ventu.ar/api/v1
RUN pnpm build

# Estadio 2: Ejecución
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
