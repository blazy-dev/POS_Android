import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../api/supabase';
import { apiConfig } from '../api/client';
import { setAppMeta } from '../database';

WebBrowser.maybeCompleteAuthSession();

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
      console.log('[AUTH] Resultado navegador:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('[AUTH] Callback recibida');
        const getParam = (url: string, param: string) => {
          const regex = new RegExp(`[#?&]${param}=([^&#]*)`);
          const results = regex.exec(url);
          return results ? decodeURIComponent(results[1]) : '';
        };

        const accessToken = getParam(result.url, 'access_token');
        console.log('[AUTH] accessToken:', accessToken ? 'SI' : 'NO');

        if (!accessToken) {
          console.error('[AUTH] No se recibio access_token en el callback');
          return false;
        }

        // NO llamar a supabase.auth.setSession() aqui: internamente hace fetch()
        // a Supabase y falla con "Network request failed" en el celular.
        // El backend se encarga de validar el token via JWKS de Supabase.

        console.log('[AUTH] Verificando estado en backend...');
        const statusRes = await fetch(`${apiConfig.baseUrl}/auth/status`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log('[AUTH] Backend status:', statusRes.status);

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          console.error(
            '[AUTH] Backend error:',
            statusRes.status,
            errText.slice(0, 200),
          );
          throw new Error(`Backend respondio con ${statusRes.status}`);
        }

        const statusData = await statusRes.json();
        console.log(
          '[AUTH] Status response:',
          JSON.stringify(statusData).slice(0, 200),
        );

        if (statusData.data?.exists) {
          console.log('[AUTH] Usuario existe, sincronizando...');
          return await syncWithBackend(db, accessToken);
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
      return false;
    } catch (err) {
      console.error('[AUTH] Error al iniciar sesión con Google:', err);
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
      setOnboardingToken(null);
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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignorar error de desconexión
    }
    setUser(null);
    setOnboardingToken(null);
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
