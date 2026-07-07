import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { Alert } from 'react-native';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../api/supabase';
import { apiConfig, setCachedToken } from '../api/client';
import { setAppMeta, enqueueSyncOperation, getAppMeta } from '../database';
import { createLocalId } from '../utils/ids';
import { runSync } from '../sync';

WebBrowser.maybeCompleteAuthSession();

/**
 * Migrates local-only users (tenant_id='local') to the real tenant_id
 * and enqueues sync operations to push them to the backend.
 * Seed users (email ending in @pos.local) are skipped.
 */
async function migrateLocalUsers(
  db: SQLiteDatabase,
  realTenantId: string,
  currentUserEmail: string,
) {
  // Re-tag all non-seed local users with the real tenant_id
  await db.runAsync(
    `UPDATE users SET tenant_id = $real_tenant_id
     WHERE tenant_id = 'local' AND email NOT IN ('admin@pos.local', 'cajero@pos.local')`,
    { $real_tenant_id: realTenantId },
  );

  // Enqueue sync for migrated users (so backend gets them)
  const migrated = await db.getAllAsync<{
    id: string;
    name: string;
    email: string;
    pin: string | null;
    role: string;
  }>(
    `SELECT id, name, email, pin, role FROM users
     WHERE tenant_id = $tenant_id AND is_active = 1 AND email != $current_email`,
    { $tenant_id: realTenantId, $current_email: currentUserEmail },
  );

  const now = new Date().toISOString();
  for (const u of migrated) {
    // Skip if there's already a pending sync operation for this user
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM sync_operations
       WHERE entity_type = 'user' AND entity_id = $entity_id AND status = 'pending'`,
      { $entity_id: u.id },
    );
    if (existing) continue;

    await enqueueSyncOperation(db, {
      id: createLocalId('sync'),
      entityType: 'user',
      entityId: u.id,
      kind: 'create',
      payload: {
        id: u.id,
        tenant_id: realTenantId,
        name: u.name,
        email: u.email,
        pin: u.pin,
        role: u.role,
        is_active: 1,
        created_at: now,
        updated_at: now,
      },
    });
  }
  console.log(`[AUTH] Migrados ${migrated.length} usuarios locales al tenant real`);
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier' | 'supervisor';
}

type AuthContextType = {
  user: User | null;
  login: (db: SQLiteDatabase, pin: string) => Promise<boolean>;
  loginWithGoogle: (db: SQLiteDatabase) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
  onboardingToken: string | null;
  completeOnboarding: (
    db: SQLiteDatabase,
    tenantName: string,
    currency: string,
    timezone: string,
  ) => Promise<boolean>;
  cancelOnboarding: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);

  // Sincroniza el usuario autenticado por Supabase con el backend NestJS
  async function syncWithBackend(
    db: SQLiteDatabase,
    token: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${apiConfig.baseUrl}/auth/register-or-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenant_name: 'Mi Comercio POS',
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status}`);
      }

      const resData = await response.json();
      const apiData = resData.data;

      if (!apiData || !apiData.user || !apiData.tenant) {
        throw new Error(
          'Respuesta de autenticación del backend inválida o incompleta',
        );
      }

      const userProfile: User = {
        id: apiData.user.id,
        tenant_id: apiData.tenant.id,
        name: apiData.user.name,
        email: apiData.user.email,
        role: apiData.user.role,
      };

      if (apiData.tenant.email) {
        await setAppMeta(
          db,
          `tenant_owner_email_${apiData.tenant.id}`,
          apiData.tenant.email,
        );
      }

      // Guardar el perfil del usuario localmente en SQLite
      await db.runAsync(
        `INSERT INTO users (id, tenant_id, name, email, role, is_active, created_at, updated_at)
         VALUES ($id, $tenant_id, $name, $email, $role, 1, $now, $now)
         ON CONFLICT(id) DO UPDATE SET
           tenant_id = excluded.tenant_id,
           name = excluded.name,
           email = excluded.email,
           role = excluded.role,
           updated_at = excluded.updated_at`,
        {
          $id: userProfile.id,
          $tenant_id: userProfile.tenant_id,
          $name: userProfile.name,
          $email: userProfile.email,
          $role: userProfile.role,
          $now: new Date().toISOString(),
        },
      );

      await setAppMeta(db, `tenant_${apiData.tenant.id}`, apiData.tenant.name);

      setUser(userProfile);
      return true;
    } catch (e) {
      console.error('Error al sincronizar perfil con el backend:', e);
      return false;
    }
  }

  // Carga inicial para restaurar sesión persistente desde Supabase/SQLite
  useEffect(() => {
    async function restoreSession() {
      try {
        // Intentar restaurar sesión offline-first usando nuestro almacenamiento seguro local
        const savedToken = await SecureStore.getItemAsync('custom_access_token');
        const savedUserId = await SecureStore.getItemAsync('logged_in_user_id');

        if (savedToken && savedUserId) {
          console.log('[AUTH] Restaurando sesión localmente persistida para:', savedUserId);
          setCachedToken(savedToken);
          const localUser = await db.getFirstAsync<User>(
            `SELECT id, tenant_id, name, email, role
             FROM users
             WHERE id = $id AND is_active = 1`,
            { $id: savedUserId },
          );

          if (localUser) {
            setUser(localUser);
            return;
          }
        }

        // Fallback al cliente de Supabase si no se encuentra sesión local manual
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session && session.user) {
          const localUser = await db.getFirstAsync<User>(
            `SELECT id, tenant_id, name, email, role
             FROM users
             WHERE id = $id AND is_active = 1`,
            { $id: session.user.id },
          );

          if (localUser) {
            setUser(localUser);
          } else {
            // Auto-curación: si no existe localmente pero hay token, sincroniza con NestJS
            await syncWithBackend(db, session.access_token);
          }
        }
      } catch (err) {
        console.error('Error al restaurar sesión:', err);
      }
    }
    // Para que funcione, el hook requiere que tengamos la instancia de db abierta y lista
    // En Expo SQLite useSQLiteContext provee db asincrónicamente
    void restoreSession();
  }, [db]);

  // Login offline rápido por PIN para cajeros
  async function login(db: SQLiteDatabase, pin: string): Promise<boolean> {
    try {
      setLoading(true);
      const row = await db.getFirstAsync<User>(
        `SELECT id, tenant_id, name, email, role
         FROM users
         WHERE pin = $pin AND is_active = 1`,
        { $pin: pin },
      );

      if (row) {
        // Validar límite de empleados si la suscripción no está activa
        const cachedStatus = await getAppMeta<string>(db, `tenant_subscription_status_${row.tenant_id}`);
        const endsAtStr = await getAppMeta<string>(db, `tenant_subscription_ends_at_${row.tenant_id}`);
        const endsAt = endsAtStr ? parseInt(endsAtStr, 10) : 0;
        const active = cachedStatus === 'active' && (endsAt === 0 || endsAt > Date.now());

        if (!active) {
          const ownerEmail = await getAppMeta<string>(db, `tenant_owner_email_${row.tenant_id}`);
          if (row.email !== ownerEmail) {
            // Obtener todos los empleados activos ordenados por fecha de creación
            const allEmployees = await db.getAllAsync<{ id: string; email: string }>(
              `SELECT id, email FROM users WHERE (tenant_id = $tenantId OR tenant_id = 'local') AND is_active = 1 ORDER BY created_at ASC`,
              { $tenantId: row.tenant_id }
            );

            // Filtrar empleados locales (que no sean el dueño)
            const localEmployees = allEmployees.filter((e) => e.email !== ownerEmail);
            const localIndex = localEmployees.findIndex((e) => e.id === row.id);

            // Bloquear si supera la posición 2 de personal Demo
            if (localIndex >= 2) {
              Alert.alert(
                'Acceso denegado (Versión Demo)',
                'Este empleado está inactivo porque supera el límite de 2 usuarios de la versión de prueba. Activa la versión completa para habilitar su acceso.'
              );
              return false;
            }
          }
        }

        setUser(row);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error al iniciar sesión con PIN:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Login online para administrador mediante Google OAuth
  async function loginWithGoogle(db: SQLiteDatabase): Promise<boolean> {
    try {
      setLoading(true);
      const redirectUrl = Linking.createURL('auth-callback');
      console.log('[AUTH] redirectUrl:', redirectUrl);
      console.log('[AUTH] supabaseUrl:', apiConfig.supabaseUrl);
      console.log('[AUTH] backendUrl:', apiConfig.baseUrl);

      // Escuchar deep links entrantes de forma paralela por si Android retorna "dismiss"
      let capturedUrl: string | null = null;
      const subscription = Linking.addEventListener('url', (event) => {
        console.log('[AUTH] Deep link interceptado:', event.url);
        capturedUrl = event.url;
      });

      // Construir URL de OAuth manualmente y abrir navegador directo
      // EVITAMOS supabase.auth.signInWithOAuth() y supabase.auth.setSession()
      // porque esos metodos internamente llaman fetch() a Supabase desde el celu,
      // lo cual falla con "Network request failed" en algunos entornos de red
      const oauthUrl = `${apiConfig.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
      console.log('[AUTH] Abriendo navegador:', oauthUrl);

      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        redirectUrl,
      );
      
      // Remover listener
      subscription.remove();
      console.log('[AUTH] Resultado navegador:', result.type);

      const finalUrl = (result.type === 'success' && result.url) ? result.url : capturedUrl;

      if (finalUrl) {
        console.log('[AUTH] Callback recibida con URL:', finalUrl);
        const getParam = (url: string, param: string) => {
          const regex = new RegExp(`[#?&]${param}=([^&#]*)`);
          const results = regex.exec(url);
          return results ? decodeURIComponent(results[1]) : '';
        };

        const accessToken = getParam(finalUrl, 'access_token');
        console.log('[AUTH] accessToken:', accessToken ? 'SI' : 'NO');

        if (!accessToken) {
          console.error('[AUTH] No se recibio access_token en el callback');
          Alert.alert('Error de Redirección', 'La URL recibida no contiene el token de acceso.');
          return false;
        }

        // Cachear el token real para que la sincronizacion lo use
        // (en vez de caer en test-token que apunta a otro tenant)
        setCachedToken(accessToken);

        // Resetear lastSyncAt para que el proximo pull descargue TODO
        // (evita que sync anterior con test-token/otro tenant deje un timestamp que filtre los productos nuevos)
        await db.runAsync(
          `UPDATE device_state SET last_sync_at = NULL, updated_at = $now WHERE id = 1`,
          { $now: new Date().toISOString() },
        );

        // NO llamar a supabase.auth.setSession() aqui: internamente hace fetch()
        // a Supabase y falla con "Network request failed" en el celular.
        // El backend se encarga de validar el token via JWKS de Supabase.

        console.log('[AUTH] Verificando estado en backend...');
        let statusRes;
        try {
          statusRes = await fetch(`${apiConfig.baseUrl}/auth/status`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch (fetchErr) {
          console.error('[AUTH] Error de conexion con backend:', fetchErr);
          Alert.alert(
            'Error de Conexión',
            `No se pudo contactar al backend en ${apiConfig.baseUrl}.\n\nDetalle: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
          );
          return false;
        }

        console.log('[AUTH] Backend status:', statusRes.status);

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          console.error(
            '[AUTH] Backend error:',
            statusRes.status,
            errText.slice(0, 200),
          );
          Alert.alert(
            'Error del Backend',
            `Código HTTP: ${statusRes.status}\nRespuesta: ${errText.slice(0, 150)}`
          );
          throw new Error(`Backend respondio con ${statusRes.status}`);
        }

        const statusData = await statusRes.json();
        console.log(
          '[AUTH] Status response:',
          JSON.stringify(statusData).slice(0, 200),
        );

        if (statusData.data?.exists) {
          console.log('[AUTH] Usuario existe, sincronizando perfil...');
          const synced = await syncWithBackend(db, accessToken);
          if (synced) {
            // Guardar en SecureStore para persistencia offline-first
            await SecureStore.setItemAsync('custom_access_token', accessToken);
            await SecureStore.setItemAsync('logged_in_user_id', statusData.data.user.id);

            // Migrar usuarios locales al tenant real y encolarlos para sync
            try {
              await migrateLocalUsers(
                db,
                statusData.data.tenant.id,
                statusData.data.user.email,
              );
            } catch (e) {
              console.error('[AUTH] Error migrando usuarios locales:', e);
            }

            // Disparar sync inmediato (productos, categorias, usuarios, etc)
            void runSync(db).then((result) => {
              console.log('[AUTH] Sync post-login:', result.pushedCount, 'subidos,', result.pulledCount, 'descargados');
            });
          }
          return synced;
        } else {
          console.log('[AUTH] Usuario nuevo, guardando token para onboarding');
          setOnboardingToken(accessToken);
          return false;
        }
      }
      console.log(
        '[AUTH] Navegador cerrado sin exito (type:',
        result.type,
        ')',
      );
      Alert.alert(
        'Flujo Cancelado',
        `El navegador se cerró sin completar la autenticación. Tipo de cierre: ${result.type}.`
      );
      return false;
    } catch (err) {
      console.error('[AUTH] Error al iniciar sesión con Google:', err);
      Alert.alert(
        'Error Inesperado',
        `Ocurrió un error inesperado durante el login con Google.\n\nDetalle: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Completa el registro del comercio (Onboarding)
  async function completeOnboarding(
    db: SQLiteDatabase,
    tenantName: string,
    currency: string,
    timezone: string,
  ): Promise<boolean> {
    if (!onboardingToken) {
      console.error('No hay token de onboarding disponible.');
      return false;
    }

    try {
      setLoading(true);
      setCachedToken(onboardingToken);

      await db.runAsync(
        `UPDATE device_state SET last_sync_at = NULL, updated_at = $now WHERE id = 1`,
        { $now: new Date().toISOString() },
      );

      const response = await fetch(
        `${apiConfig.baseUrl}/auth/register-or-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${onboardingToken}`,
          },
          body: JSON.stringify({
            tenant_name: tenantName,
            currency,
            timezone,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status}`);
      }

      const resData = await response.json();
      const apiData = resData.data;

      if (!apiData || !apiData.user || !apiData.tenant) {
        throw new Error(
          'Respuesta de onboarding del backend inválida o incompleta',
        );
      }

      const userProfile: User = {
        id: apiData.user.id,
        tenant_id: apiData.tenant.id,
        name: apiData.user.name,
        email: apiData.user.email,
        role: apiData.user.role,
      };

      if (apiData.tenant.email) {
        await setAppMeta(
          db,
          `tenant_owner_email_${apiData.tenant.id}`,
          apiData.tenant.email,
        );
      }

      // Guardar el perfil del usuario localmente en SQLite
      await db.runAsync(
        `INSERT INTO users (id, tenant_id, name, email, role, is_active, created_at, updated_at)
         VALUES ($id, $tenant_id, $name, $email, $role, 1, $now, $now)
         ON CONFLICT(id) DO UPDATE SET
           tenant_id = excluded.tenant_id,
           name = excluded.name,
           email = excluded.email,
           role = excluded.role,
           updated_at = excluded.updated_at`,
        {
          $id: userProfile.id,
          $tenant_id: userProfile.tenant_id,
          $name: userProfile.name,
          $email: userProfile.email,
          $role: userProfile.role,
          $now: new Date().toISOString(),
        },
      );

      await setAppMeta(db, `tenant_${apiData.tenant.id}`, apiData.tenant.name);

      // Guardar en SecureStore para persistencia offline-first de sesión de onboarding
      await SecureStore.setItemAsync('custom_access_token', onboardingToken);
      await SecureStore.setItemAsync('logged_in_user_id', userProfile.id);

      setUser(userProfile);
      setOnboardingToken(null);

      // Migrar usuarios locales al tenant real
      try {
        await migrateLocalUsers(db, userProfile.tenant_id, userProfile.email);
      } catch (e) {
        console.error('[AUTH] Error migrando usuarios locales:', e);
      }

      void runSync(db).then((result) => {
        console.log('[AUTH] Sync post-onboarding:', result.pushedCount, 'subidos,', result.pulledCount, 'descargados');
      });

      return true;
    } catch (e) {
      console.error('Error al completar el onboarding:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }

  function cancelOnboarding() {
    setOnboardingToken(null);
  }

  async function logout() {
    setCachedToken(null);
    try {
      await SecureStore.deleteItemAsync('custom_access_token');
      await SecureStore.deleteItemAsync('logged_in_user_id');
    } catch (e) {
      // ignorar error de almacenamiento
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignorar error de desconexion
    }
    setUser(null);
    setOnboardingToken(null);

    // Resetear lastSyncAt para que el proximo login haga pull completo
    try {
      await db.runAsync(
        `UPDATE device_state SET last_sync_at = NULL, updated_at = $now WHERE id = 1`,
        { $now: new Date().toISOString() },
      );
    } catch (_) {
      /* ignorar */
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        logout,
        loading,
        onboardingToken,
        completeOnboarding,
        cancelOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
