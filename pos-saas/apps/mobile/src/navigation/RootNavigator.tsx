import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { getAppMeta } from '../database';
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
  const db = useSQLiteContext();
  const { user, onboardingToken } = useAuth();
  // Estado local para saber qué pantalla se encuentra activa
  const [route, setRoute] = useState<RouteKey>('home');
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [isSubActive, setIsSubActive] = useState<boolean>(true);

  // Hook para obtener los insets de áreas seguras del dispositivo (notch, barra de navegación, etc.)
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    async function checkSubscription() {
      if (!user) return;
      try {
        const tenantId = user.tenant_id || 'local';
        const cachedStatus = await getAppMeta<string>(db, `tenant_subscription_status_${tenantId}`);
        const endsAtStr = await getAppMeta<string>(db, `tenant_subscription_ends_at_${tenantId}`);
        const endsAt = endsAtStr ? parseInt(endsAtStr, 10) : 0;
        const active = cachedStatus === 'active' && (endsAt === 0 || endsAt > Date.now());
        setIsSubActive(active);
      } catch (err) {
        console.error('Error al comprobar suscripción en RootNavigator:', err);
      }
    }
    void checkSubscription();
  }, [db, user, route]); // Re-validar al cambiar de pestaña por si se modificó desde Licencias

  const handleNavigate = (nextRoute: RouteKey, params?: any) => {
    setRoute(nextRoute);
    setNavigationParams(params);
  };

  // Selecciona dinámicamente el componente de pantalla correspondiente según la ruta actual
  const Screen = useMemo<
    React.ComponentType<{ onNavigate: (route: RouteKey, params?: any) => void; navigationParams?: any }>
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
      <View style={{
        paddingTop: insets.top,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 4,
      }}>
        <SyncBar />
        {!isSubActive && (
          <View style={styles.demoHeaderBadge}>
            <Ionicons name="lock-closed" size={11} color="#ffffff" style={{ marginRight: 3 }} />
            <Text style={styles.demoHeaderBadgeText}>Versión Demo</Text>
          </View>
        )}
      </View>

      {/* Área del contenedor principal de la pantalla activa */}
      <View style={styles.screenArea}>
        <Screen onNavigate={handleNavigate} navigationParams={navigationParams} />
      </View>

      {/* Barra de navegación inferior: píldora flotante */}
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

          // Tab especial "Ventas": círculo flotante que escapa de la píldora
          if (isSales) {
            return (
              <Pressable
                key={item.key}
                onPress={() => setRoute(item.key)}
                style={styles.tabItemSales}
              >
                <View
                  style={[
                    styles.salesBubble,
                    {
                      backgroundColor: active
                        ? colors.success
                        : isDark
                        ? 'rgba(39,39,42,0.92)'
                        : 'rgba(244,244,245,0.92)',
                    },
                  ]}
                >
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={22}
                    color={active ? '#ffffff' : colors.textMuted}
                  />
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={item.key}
              onPress={() => setRoute(item.key)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={18}
                color={active ? activeColor : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  active && styles.tabLabelActive,
                  active && { color: activeColor },
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
      height: 52,
      paddingHorizontal: 16,
      borderRadius: radius.full,
      backgroundColor: isDark ? 'rgba(18, 18, 20, 0.82)' : 'rgba(250, 250, 250, 0.85)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      overflow: 'visible',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 3,
      gap: 2,
    },
    tabItemActive: {
      // Light highlight
    },
    // Tab Ventas: centrado en el eje vertical del tabBar
    tabItemSales: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center', // El círculo se centra en la barra y sobresale arriba y abajo
    },
    // Círculo centrado que sobresale simétricamente por arriba y por abajo de la píldora
    salesBubble: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: -5, // (62 - 52) / 2 = 5 → centrado simétrico con barra de 52px
      borderWidth: 3,
      borderColor: colors.background, // Separa el círculo de la pill visualmente
      // iOS: glow uniforme con shadowOffset {0,0}
      shadowColor: colors.success,
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
      // Android: elevation:0 → sin sombra direccional (no hay forma de hacerla uniforme con elevation)
      elevation: 0,
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
    demoHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#b45309',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      marginRight: 4,
      marginTop: 2,
    },
    demoHeaderBadgeText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },
  });
