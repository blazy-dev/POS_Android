# CONEXION APP x BACKEND

Documento de referencia para entender, debuggear y nunca volver a sufrir la conexion entre la app movil (Expo/React Native), el backend (NestJS) y Supabase.

Fecha: 2026-07-01
Autor: Documentado tras resolver "TypeError: Network request failed" en login Google

---

## 1. DIAGRAMA DE CONEXION

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│   CELULAR/APP   │ ──────────────>│    SUPABASE      │
│ (Expo React N.) │                │ (Auth + DB)      │
│                 │                │                  │
│ 192.168.0.x     │                │ dukyedgoyshhtjku │
└────────┬────────┘                │ .supabase.co     │
         │                         └────────┬─────────┘
         │ HTTP (LAN)                       │
         │                                 │
         │  ┌──────────────────┐           │
         │  │       PC         │           │ HTTPS (JWKS)
         └─>│                  │<──────────┘
            │ Metro :8081      │
            │ Backend :3001    │
            │ Web :3000        │
            └──────────────────┘
```

### Quien habla con quien

| Origen | Destino | Protocolo | Puerto | Para que |
|--------|---------|-----------|--------|----------|
| Celular | PC (Metro) | HTTP | 8081 | Cargar bundle JS de Expo |
| Celular | PC (Backend) | HTTP | 3001 | API calls (/api/v1/*) |
| Celular | Supabase | HTTPS | 443 | OAuth en navegador (NO fetch) |
| PC (Backend) | Supabase | HTTPS | 443 | Validar JWT (JWKS) + Prisma DB |
| PC (Web) | Supabase | HTTPS | 443 | Auth via @supabase/ssr |
| PC (Web) | PC (Backend) | HTTP | 3001 | API calls del dashboard |

---

## 2. URLs Y VARIABLES DE ENTORNO

### 2.1 App Movil (apps/mobile/.env)

```env
EXPO_PUBLIC_SUPABASE_URL=https://dukyedgoyshhtjkuphow.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VqVvijnn9uzhCjaAUJgvaw_FqZ_2jyA

# URL del backend NestJS
# Emulador Android:   http://10.0.2.2:3001/api/v1
# Dispositivo fisico: http://<IP_DE_TU_PC>:3001/api/v1
EXPO_PUBLIC_API_URL=http://192.168.0.10:3001/api/v1
```

> **IMPORTANTE:** Las variables EXPO_PUBLIC_* se inyectan en el bundle al iniciar Metro. Si cambias .env, reinicia Expo.

### 2.2 Backend (apps/backend/.env)

```env
DATABASE_URL="postgresql://postgres.dukyedgoyshhtjkuphow:...@aws-1-us-west-2.pooler.supabase.com:5432/postgres"
SUPABASE_JWT_SECRET="LeGS5lBDHafUMGZLU/Ibn4eNmPWpcltg/rjJr8Lylv589F8fiLlK0gn5IYC9/iZAUbXI1NYLfe7XWVyGYbVg1g=="
```

### 2.3 App Web (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://dukyedgoyshhtjkuphow.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_VqVvijnn9uzhCjaAUJgvaw_FqZ_2jyA
```

---

## 3. FLUJO DE AUTENTICACION (GOOGLE OAUTH)

### 3.1 Flujo en la app movil (CORRECTO - documentado 2026-07-01)

```
1. Construir URL de OAuth manualmente:
   https://dukyedgoyshhtjkuphow.supabase.co/auth/v1/authorize
     ?provider=google
     &redirect_to=<Linking.createURL("auth-callback")>

2. Abrir navegador del sistema:
   WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl)

3. Usuario se loguea en Google

4. Google redirige al navegador a redirect_to con tokens:
   exp://192.168.0.10:8081/--/auth-callback#access_token=...&refresh_token=...

5. Extraer access_token del callback URL

6. Llamar al BACKEND (NO a Supabase):
   GET http://192.168.0.10:3001/api/v1/auth/status
   Header: Authorization: Bearer <access_token>

7. Backend valida el JWT via JWKS de Supabase
   (fetch https://dukyedgoyshhtjkuphow.supabase.co/auth/v1/.well-known/jwks.json)

8. Si usuario existe -> syncWithBackend -> POST /auth/register-or-link
   Si usuario nuevo -> guardar token para onboarding
```

### 3.2 Lo que NUNCA debe hacer la app movil

```typescript
// ❌ NO USAR ESTOS METODOS DEL SDK DE SUPABASE EN EL CELULAR ❌
// Motivo: internamente hacen fetch() a Supabase y en algunos entornos
// de red movil tiran "TypeError: Network request failed"
// aunque el navegador del celu SI puede cargar supabase.co

await supabase.auth.setSession({ ... })
//  └─ internamente llama fetch() a /auth/v1/user

await supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })
//  └─ no hace fetch, pero acopla al SDK innecesariamente

await supabase.auth.getSession()
//  └─ lee de SecureStore local (OK si no hay sesion expirada)
//     PERO si hay sesion expirada, intenta refrescar con fetch()
```

### 3.3 Metodos seguros del SDK de Supabase en el celular

```typescript
// ✅ OK - solo leen/escriben storage local (SecureStore)
supabase.auth.signOut()
//  └─ el catch {} atrapa cualquier error de red

// ✅ OK si no hay sesion guardada (retorna null rapido)
supabase.auth.getSession()
//  └─ SI hay sesion expirada -> intenta refresh -> puede fallar
//  └─ Siempre en try/catch
```

---

## 4. BACKEND: COMO VALIDA LOS JWTs DE SUPABASE

### 4.1 Guard de autenticacion (auth/supabase.guard.ts)

```
Token recibido en Authorization: Bearer <jwt>

├── Si token === "test-token" -> usuario demo hardcodeado (desarrollo)
│
├── Si token no es JWT de 3 partes -> usuario demo (desarrollo)
│
├── Si alg === ES256 o RS256 (asimetrico - Supabase estandar)
│   ├── Validar que iss termine en .supabase.co/auth/v1
│   ├── Extraer project ref de DATABASE_URL (regex: /postgres\.([^:]+)@/)
│   ├── Validar que iss contenga https://<project-ref>.supabase.co
│   ├── Fetch JWKS de {iss}/.well-known/jwks.json (cacheado, rate-limit 10/min)
│   └── Verificar firma con clave publica
│
└── Si alg es otro (HS256 fallback)
    ├── Intentar verificacion con SUPABASE_JWT_SECRET decodificado Base64
    └── Si falla, intentar con SUPABASE_JWT_SECRET como string
```

### 4.2 Endpoints de auth

| Ruta | Guard | Descripcion |
|------|-------|-------------|
| GET /api/v1/auth/status | SupabaseAuthGuard + @CurrentSupabaseUser | Verifica si el usuario existe en DB local. **NO requiere registro previo.** |
| POST /api/v1/auth/register-or-link | SupabaseAuthGuard + @CurrentSupabaseUser | Crea o vincula usuario + tenant. Acepta tenant_name, currency, timezone. |
| GET /api/v1/auth/tenant | SupabaseAuthGuard + @CurrentUser | Devuelve datos del tenant. Requiere registro previo (401 si no). |
| PUT /api/v1/auth/tenant | SupabaseAuthGuard + @CurrentUser | Modifica tenant. Solo admin. |

**Diferencia entre @CurrentSupabaseUser y @CurrentUser:**
- @CurrentSupabaseUser: Devuelve claims del JWT (id, email, name). Funciona inmediatamente despues del login.
- @CurrentUser: Devuelve registro completo de Prisma. Tira 401 si el usuario no se registro via /auth/register-or-link.

---

## 5. FIREWALL Y RED

### 5.1 Puertos necesarios

| Puerto | Servicio | Direccion | Necesario para |
|--------|----------|-----------|----------------|
| 8081 | Metro (Expo) | Entrante | Cargar bundle JS en el celular |
| 3001 | NestJS | Entrante | API calls desde el celular |
| 19000 | Expo (opcional) | Entrante | QR de conexion |

### 5.2 Como verificar conectividad

```powershell
# Desde la PC (siempre funciona)
curl http://localhost:3001/api/v1/health

# Desde la PC hacia su propia IP (verifica que el servidor escucha en la red)
curl http://192.168.0.10:3001/api/v1/health

# Ver si el puerto esta escuchando
netstat -an | findstr :3001
```

### 5.3 Firewall de Windows

Si el celular no puede llegar al backend pero la PC si:

1. Abrir "Windows Defender Firewall with Advanced Security"
2. Inbound Rules -> New Rule -> Port -> TCP 3001 -> Allow
3. O permitir la app node.exe directamente

### 5.4 Verificar desde el celular

Abrir el navegador del celular y visitar:
```
http://192.168.0.10:3001/api/v1/health
```
Debe responder: {"status":"ok"}

Si carga el bundle de Expo (puerto 8081) pero NO responde el backend (puerto 3001):
-> **Firewall de Windows bloqueando puerto 3001**

---

## 6. ERRORES COMUNES Y SOLUCIONES

### 6.1 "TypeError: Network request failed" en login con Google

**Causa raiz:** El SDK de Supabase (@supabase/supabase-js) ejecuta metodos que internamente llaman fetch() a supabase.co. En entornos de red movil, el fetch() de React Native puede fallar aunque el navegador del sistema si pueda cargar la URL.

**Metodos del SDK que hacen fetch() internamente:**
- supabase.auth.setSession() -> GET /auth/v1/user
- supabase.auth.getSession() (con sesion expirada) -> POST /token?grant_type=refresh_token
- supabase.auth.refreshSession() -> POST /token?grant_type=refresh_token

**Solucion aplicada (2026-07-01):**
- Construir la URL de OAuth manualmente (string concatenation)
- Abrirla con WebBrowser.openAuthSessionAsync()
- Extraer el access_token del callback
- NO llamar a setSession() en el celular
- Validar el token contra el backend (NO contra Supabase directo)
- El backend se encarga de validar el JWT via JWKS de Supabase

**Archivo clave:** apps/mobile/src/context/AuthContext.tsx -> loginWithGoogle()

### 6.2 "Cannot connect to development server"

**Causa:** El celular no puede alcanzar el Metro server en la PC.

**Solucion:**
1. Verificar que PC y celu esten en la misma red WiFi
2. Verificar IP de la PC: ipconfig | findstr IPv4
3. Actualizar EXPO_PUBLIC_API_URL en .env con la IP correcta
4. Reiniciar Expo: pnpm run start --clear

### 6.3 Backend responde 401 a pesar de tener token valido

**Causa:** El SUPABASE_JWT_SECRET en .env no coincide con el del proyecto Supabase.

**Solucion:**
1. Ir a Supabase Dashboard -> Project Settings -> API
2. Copiar el "JWT Secret" (no el anon key)
3. Pegarlo en backend/.env como SUPABASE_JWT_SECRET

### 6.4 Backend responde 500 en auth/register-or-link

**Causa:** Error de conexion a la base de datos (Prisma) o tenant ya existe.

**Solucion:**
1. Verificar DATABASE_URL en backend/.env
2. Correr migraciones: cd backend && pnpm prisma migrate deploy
3. Verificar logs del backend para el error especifico

### 6.5 Seccion de gestion de empleados no aparece en la app movil

**Causa:** Al skippear `supabase.auth.setSession()` (ver seccion 3.2), `supabase.auth.getSession()` devuelve `null`. La `SettingsScreen` usaba `getSession()` para obtener el token y cargar los datos del comercio. Sin token, `tenantInfo` quedaba vacio y todo el bloque que contiene el boton "Gestionar Empleados" no se renderizaba.

**Solucion aplicada (2026-07-01):**
1. `SettingsScreen.tsx` ahora usa `getCachedToken()` en vez de `supabase.auth.getSession()` para todas las llamadas al backend (`/auth/tenant` GET y PUT)
2. El boton "Gestionar Empleados" se movio a su propia tarjeta, fuera del bloque condicional de `tenantInfo`, para que siempre sea visible para admins aunque el tenant info no cargue

**Leccion:** Cualquier pantalla del movil que necesite el token debe usar `getCachedToken()`, NO `supabase.auth.getSession()`. Este patron se repite en toda la app por el skip de `setSession()`.

---

## 7. ARQUITECTURA DEL CODIGO (archivos clave)

### 7.1 App Movil

| Archivo | Responsabilidad |
|---------|----------------|
| apps/mobile/src/context/AuthContext.tsx | Flujo completo de auth: login Google, login PIN, onboarding, logout |
| apps/mobile/src/api/supabase.ts | Inicializa el cliente Supabase con SecureStore adapter |
| apps/mobile/src/api/client.ts | URLs + setCachedToken/getCachedToken + getAuthToken (cachedToken > session > test-token) |
| apps/mobile/src/screens/SettingsScreen.tsx | Usar getCachedToken() NO supabase.auth.getSession() — setSession() fue skippeado |
| apps/mobile/.env | Variables EXPO_PUBLIC_* (inyectadas en build time) |

### 7.2 Backend NestJS

| Archivo | Responsabilidad |
|---------|----------------|
| backend/src/main.ts | Fastify + CORS + puerto + prefijo global api/v1 |
| backend/src/auth/supabase.guard.ts | Validacion de JWT de Supabase (JWKS + HS256 fallback) |
| backend/src/auth/auth.controller.ts | Endpoints /auth/status, /auth/register-or-link, etc. |
| backend/src/auth/auth.service.ts | Logica de negocio: crear tenant, usuario, roles |
| backend/src/auth/user.decorator.ts | Decoradores @CurrentSupabaseUser y @CurrentUser |
| backend/.env | DATABASE_URL, SUPABASE_JWT_SECRET |

### 7.3 App Web (Next.js)

| Archivo | Responsabilidad |
|---------|----------------|
| apps/web/src/lib/api.ts | Cliente HTTP centralizado con apiFetch |
| apps/web/src/context/AuthContext.tsx | Auth via @supabase/ssr (server-side cookies) |
| apps/web/.env.local | NEXT_PUBLIC_* variables |
