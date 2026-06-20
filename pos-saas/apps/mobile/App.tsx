import * as SQLite from "expo-sqlite";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initializeDatabase } from "./src/database";
import { AuthProvider } from "./src/context/AuthContext";
import { SyncProvider } from "./src/context/SyncContext";
import { ThemeProvider } from "./src/context/ThemeContext";

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * AppErrorBoundary es un componente de React que captura errores en cualquier parte de la jerarquía de
 * componentes hijo, registra el error y muestra una interfaz de usuario alternativa en lugar del fallo catastrófico.
 */
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  // Actualiza el estado para que el siguiente renderizado muestre la pantalla de error alternativa
  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  // Registra el error en la consola (en producción se podría conectar con Sentry)
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crash:", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      // Pantalla de error amigable cuando la app falla críticamente en su inicio o renderizado
      return (
        <SafeAreaProvider>
          <View style={styles.errorScreen}>
            <Text style={styles.errorTitle}>Error al iniciar la app</Text>
            <ScrollView contentContainerStyle={styles.errorBody}>
              <Text style={styles.errorMessage}>{this.state.error.message}</Text>
            </ScrollView>
          </View>
        </SafeAreaProvider>
      );
    }

    return this.props.children;
  }
}

/**
 * Componente principal de la aplicación.
 * 1. Envuelve la aplicación en el cargador de límites de error (AppErrorBoundary).
 * 2. Proporciona el contexto de área segura (SafeAreaProvider).
 * 3. Configura el proveedor de base de datos SQLite local (SQLiteProvider) inicializando 'pos_local.db'
 *    mediante la función 'initializeDatabase' (encargada de migraciones y esquemas).
 * 4. Envuelve con ThemeProvider para proveer el tema dinámico (Claro/Oscuro).
 * 5. Envuelve con AuthProvider para gestionar la sesión offline del usuario.
 * 6. Renderiza el navegador principal (RootNavigator).
 */
export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <SQLite.SQLiteProvider databaseName="pos_local.db" onInit={initializeDatabase}>
          <ThemeProvider>
            <AuthProvider>
              <SyncProvider>
                <RootNavigator />
              </SyncProvider>
            </AuthProvider>
          </ThemeProvider>
        </SQLite.SQLiteProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}


const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: "#01022e",
    padding: 20,
    gap: 12,
  },
  errorTitle: {
    color: "#FFB4B4",
    fontSize: 20,
    fontWeight: "800",
  },
  errorBody: {
    paddingBottom: 24,
  },
  errorMessage: {
    color: "#EAF4FF",
    fontSize: 14,
    lineHeight: 21,
  },
});