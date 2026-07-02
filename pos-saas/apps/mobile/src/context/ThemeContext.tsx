import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getAppMeta, setAppMeta } from '../database';
import { lightColors, darkColors, ThemeColors } from '../theme/tokens';

type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
  theme: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [theme, setTheme] = useState<ThemeMode>('dark'); // El valor predeterminado es oscuro por la identidad de la marca

  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const stored = await getAppMeta<ThemeMode>(db, 'app_theme');
        if (stored === 'light' || stored === 'dark') {
          setTheme(stored);
        }
      } catch (err) {
        console.error('Error al cargar la preferencia de tema de SQLite:', err);
      }
    }
    loadStoredTheme();
  }, [db]);

  async function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      await setAppMeta(db, 'app_theme', nextTheme);
    } catch (err) {
      console.error(
        'Error al persistir la preferencia de tema en SQLite:',
        err,
      );
    }
  }

  const colors = theme === 'dark' ? darkColors : lightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  }
  return context;
}
