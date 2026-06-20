import { createContext, useContext, useState, ReactNode } from "react";
import type { SQLiteDatabase } from "expo-sqlite";

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: "admin" | "cashier" | "supervisor";
}

type AuthContextType = {
  user: User | null;
  login: (db: SQLiteDatabase, pin: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(db: SQLiteDatabase, pin: string): Promise<boolean> {
    try {
      setLoading(true);
      const row = await db.getFirstAsync<User>(
        `SELECT id, tenant_id, name, email, role
         FROM users
         WHERE pin = $pin AND is_active = 1`,
        { $pin: pin }
      );

      if (row) {
        setUser(row);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error al iniciar sesión con PIN:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}
