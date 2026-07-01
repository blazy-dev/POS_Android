"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

interface AuthContextType {
  session: Session | null;
  user: UserProfile | null;
  tenant: TenantInfo | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync session and profile with backend
  async function syncProfile(currentSession: Session) {
    const token = currentSession.access_token;

    try {
      // 1. Check if user profile is registered in backend
      const statusData = await apiFetch<{
        success: boolean;
        data: {
          exists: boolean;
          user: { id: string; email: string; name: string; role: string };
          tenant: { id: string; name: string; currency: string; timezone: string };
        };
      }>("/auth/status", { token });

      if (statusData.success && statusData.data.exists) {
        setUser({
          id: statusData.data.user.id,
          email: statusData.data.user.email,
          name: statusData.data.user.name,
          role: statusData.data.user.role,
          tenantId: statusData.data.tenant.id,
        });
        setTenant(statusData.data.tenant);
        return;
      }

      // 2. User not in backend — auto-register
      const fullName =
        currentSession.user.user_metadata?.full_name ||
        currentSession.user.email?.split("@")[0] ||
        "My Store";

      const registerData = await apiFetch<{
        success: boolean;
        data: {
          user: { id: string; email: string; name: string; role: string };
          tenant: { id: string; name: string; currency?: string; timezone?: string };
        };
      }>("/auth/register-or-link", {
        token,
        method: "POST",
        body: JSON.stringify({
          tenant_name: `${fullName}'s Store`,
          currency: "ARS",
          timezone: "America/Argentina/Buenos_Aires",
        }),
      });

      if (registerData.success && registerData.data) {
        const apiData = registerData.data;
        setUser({
          id: apiData.user.id,
          email: apiData.user.email,
          name: apiData.user.name,
          role: apiData.user.role,
          tenantId: apiData.tenant.id,
        });
        setTenant({
          id: apiData.tenant.id,
          name: apiData.tenant.name,
          currency: apiData.tenant.currency || "ARS",
          timezone: apiData.tenant.timezone || "America/Argentina/Buenos_Aires",
        });
      }
    } catch (error) {
      console.error("Error syncing profile with backend:", error);
      // DO NOT clear user — allow Supabase session to persist even if backend is down
      // Set a minimal profile from the Supabase session so the user can access the app
      setUser({
        id: currentSession.user.id,
        email: currentSession.user.email || "",
        name:
          currentSession.user.user_metadata?.full_name ||
          currentSession.user.email?.split("@")[0] ||
          "Usuario",
        role: "admin",
        tenantId: "",
      });
    }
  }

  useEffect(() => {
    // Get initial session (handles OAuth redirect callback automatically)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession) {
        syncProfile(initialSession).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setLoading(true);
        syncProfile(newSession).finally(() => setLoading(false));
      } else {
        setUser(null);
        setTenant(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loginWithGoogle() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/login" },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error logging in with Google:", error);
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setTenant(null);
      setSession(null);
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    if (session) {
      await syncProfile(session);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        tenant,
        loading,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
