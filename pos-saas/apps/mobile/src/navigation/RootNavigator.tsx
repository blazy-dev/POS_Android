import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/HomeScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { SalesScreen } from '../screens/SalesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SyncScreen } from '../screens/SyncScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useTheme } from '../context/ThemeContext';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import type { ThemeColors } from '../theme/tokens';
import { fontSize, fontWeight, spacing, radius } from '../theme/tokens';

type RouteKey = 'home' | 'sales' | 'products' | 'sync' | 'settings' | 'reports';

// Configuración de las opciones de navegación que se muestran en el Tab Bar inferior (Ventas en el medio)
const routes: Array<{
  key: RouteKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'home', label: 'Inicio', icon: 'home-outline', iconActive: 'home' },
  { key: 'products', label: 'Productos', icon: 'cube-outline', iconActive: 'cube' },
  { key: 'sales', label: 'Ventas', icon: 'cart-outline', iconActive: 'cart' },
  { key: 'sync', label: 'Sync', icon: 'cloud-outline', iconActive: 'cloud' },
  { key: 'settings', label: 'Ajustes', icon: 'settings-outline', iconActive: 'settings' },
];

/**
 * RootNavigator gestiona la navegación principal de la aplicación mediante un sistema de tabs simple.
 */
function SyncBar() {
  const { status, pendingCount } = useSync();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  let statusColor = colors.success;
  let statusText = 'Sincronizado';
  let statusIcon: keyof typeof Ionicons.glyphMap = 'checkmark-circle';

  if (status === 'syncing') {
    statusColor = colors.info;
    statusText = 'Sincronizando...';
    statusIcon = 'sync-circle';
  } else if (status === 'offline') {
    statusColor = colors.warning;
    statusText = 'Modo Offline';
    statusIcon = 'cloud-offline';
  } else if (status === 'error') {
    statusColor = colors.danger;
    statusText = 'Error de sync';
    statusIcon = 'alert-circle';
  }

  return (
    <View style={styles.syncBar}>
      <Ionicons name={statusIcon} size={14} color={statusColor} />
      <Text style={[styles.syncText, { color: statusColor }]}>
        {statusText} {pendingCount > 0 ? `· ${pendingCount} pendiente(s)` : ''}
      </Text>
    </View>
  );
}

export function RootNavigator() {
  const { user, onboardingToken } = useAuth();
  // Estado local para saber qué pantalla se encuentra activa
  const [route, setRoute] = useState<RouteKey>('home');
  // Hook para obtener los insets de áreas seguras del dispositivo (notch, barra de navegación, etc.)
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Selecciona dinámicamente el componente de pantalla correspondiente según la ruta actual
  const Screen = useMemo<
    React.ComponentType<{ onNavigate: (route: RouteKey) => void }>
  >(() => {
    switch (route) {
      case 'reports':
        return ReportsScreen;
      case 'sales':
        return SalesScreen as any;
      case 'products':
        return ProductsScreen as any;
      case 'sync':
        return SyncScreen as any;
      case 'settings':
        return SettingsScreen as any;
      case 'home':
      default:
        return HomeScreen as any;
    }
  }, [route]);

  // Si hay un token de onboarding activo y no hay sesión de usuario, forzar OnboardingScreen
  if (onboardingToken && !user) {
    return <OnboardingScreen />;
  }

  // Si no hay sesión de usuario activa (autenticación por PIN bloqueante), forzar LoginScreen
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <View style={styles.mainContainer}>
      {/* SyncBar con padding superior para respetar el notch/barra de estado */}
      <View style={{ paddingTop: insets.top, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
        <SyncBar />
      </View>

      {/* Área del contenedor principal de la pantalla activa - Ocupa todo el alto */}
      <View style={styles.screenArea}>
        <Screen onNavigate={setRoute} />
      </View>

      {/* Barra de navegación inferior (Tab Bar) como píldora flotante absoluta transparente */}
      <View
        style={[
          styles.tabBar,
          {
            bottom: Platform.OS === 'ios' ? insets.bottom + 8 : insets.bottom + 16,
          },
        ]}
      >
        {routes.map((item) => {
          const active = item.key === route;
          const isSales = item.key === 'sales';
          const activeColor = isSales ? colors.success : colors.primary;

          return (
            <Pressable
              key={item.key}
              onPress={() => setRoute(item.key)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={isSales ? 26 : 21}
                color={active ? activeColor : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  active && styles.tabLabelActive,
                  active && { color: activeColor },
                  isSales && { fontSize: 10.5 },
                ]}
              >
                {item.label}
              </Text>
              {active && (
                <View
                  style={[
                    styles.activeIndicator,
                    { backgroundColor: activeColor },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screenArea: {
      flex: 1,
      paddingBottom: 110, // Asegura que el final del scroll pase holgadamente la píldora flotante
    },
    syncBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      gap: 6,
    },
    syncText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    tabBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radius.full,
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.25)' : 'rgba(255, 255, 255, 0.30)', // Aún más transparente y translúcido
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      gap: 2,
    },
    tabItemActive: {
      // Light highlight
    },
    activeIndicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 2,
    },
    tabLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: fontWeight.bold,
    },
  });
