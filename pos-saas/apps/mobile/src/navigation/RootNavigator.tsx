import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeScreen } from "../screens/HomeScreen";
import { ProductsScreen } from "../screens/ProductsScreen";
import { SalesScreen } from "../screens/SalesScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SyncScreen } from "../screens/SyncScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ReportsScreen } from "../screens/ReportsScreen";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/tokens";

// Definición de las claves de rutas válidas en la aplicación
type RouteKey = "home" | "sales" | "products" | "sync" | "settings" | "reports";

// Configuración de las opciones de navegación que se muestran en el Tab Bar inferior
const routes: Array<{ key: RouteKey; label: string }> = [
  { key: "home", label: "Inicio" },
  { key: "sales", label: "Ventas" },
  { key: "products", label: "Productos" },
  { key: "sync", label: "Sync" },
  { key: "settings", label: "Ajustes" },
];

/**
 * RootNavigator gestiona la navegación principal de la aplicación mediante un sistema de tabs simple.
 */
function SyncBar() {
  const { status, pendingCount } = useSync();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  let statusColor = "#7AE6B3";
  let statusText = "Sincronizado";

  if (status === "syncing") {
    statusColor = "#8AC7FF";
    statusText = "Sincronizando...";
  } else if (status === "offline") {
    statusColor = "#FFC069";
    statusText = "Modo Offline";
  } else if (status === "error") {
    statusColor = "#FFB4B4";
    statusText = "Error de sincronización";
  }

  return (
    <View style={styles.syncBar}>
      <View style={[styles.syncDot, { backgroundColor: statusColor }]} />
      <Text style={styles.syncText}>
        {statusText} {pendingCount > 0 ? `· ${pendingCount} pendiente(s)` : ""}
      </Text>
    </View>
  );
}

export function RootNavigator() {
  const { user } = useAuth();
  // Estado local para saber qué pantalla se encuentra activa
  const [route, setRoute] = useState<RouteKey>("home");
  // Hook para obtener los insets de áreas seguras del dispositivo (notch, barra de navegación, etc.)
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Selecciona dinámicamente el componente de pantalla correspondiente según la ruta actual
  const Screen = useMemo<React.ComponentType<{ onNavigate: (route: RouteKey) => void }>>(() => {
    switch (route) {
      case "reports":
        return ReportsScreen;
      case "sales":
        return SalesScreen as any;
      case "products":
        return ProductsScreen as any;
      case "sync":
        return SyncScreen as any;
      case "settings":
        return SettingsScreen as any;
      case "home":
      default:
        return HomeScreen as any;
    }
  }, [route]);

  // Si no hay sesión de usuario activa (autenticación por PIN bloqueante), forzar LoginScreen
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <SyncBar />
      {/* Área del contenedor principal de la pantalla activa */}
      <View style={styles.screenArea}>
        <Screen onNavigate={setRoute} />
      </View>

      {/* Barra de navegación inferior (Tab Bar) con padding dinámico para iOS/Android */}
      <View style={[styles.tabBar, { paddingBottom: 12 + insets.bottom }]}>
        {routes.map((item) => {
          const active = item.key === route;

          return (
            <Pressable
              key={item.key}
              onPress={() => setRoute(item.key)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenArea: {
    flex: 1,
  },
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: isDark ? "rgba(7, 17, 31, 0.96)" : "#FFFFFF",
    // Sombra diferenciada según la plataforma
    ...(Platform.OS === "android"
      ? {
          elevation: 12,
        }
      : {
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -4 },
        }),
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
  },
  tabItemActive: {
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.18)" : "rgba(4, 151, 191, 0.12)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(138, 199, 255, 0.22)" : "rgba(4, 151, 191, 0.25)",
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: isDark ? "#EAF4FF" : colors.primary,
  },
});