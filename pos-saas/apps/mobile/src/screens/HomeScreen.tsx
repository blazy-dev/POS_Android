import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionCard } from '../components/ActionCard';
import { MetricCard } from '../components/MetricCard';
import { Badge } from '../components/ui/Badge';
import {
  getProductsCount,
  listPendingSyncOperations,
  getAppMeta,
} from '../database';
import {
  getDailySalesSummary,
  getLowStockProducts,
  type DailySalesSummary,
  type LowStockProductRecord,
} from '../modules/reports';
import { radius, spacing, fontSize, fontWeight, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

interface HomeScreenProps {
  onNavigate: (route: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { status } = useSync();
  const isCashier = user?.role === 'cashier';
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [productsCount, setProductsCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [dailySummary, setDailySummary] = useState<DailySalesSummary>({
    transaction_count: 0,
    cash_total: 0,
    transfer_total: 0,
    sales_total: 0,
  });
  const [lowStock, setLowStock] = useState<LowStockProductRecord[]>([]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');

  // Estados para la rotación animada de Efectivo / Transferencia
  const [metricsMode, setMetricsMode] = useState<'cash' | 'transfer'>('cash');
  const fadeAnim = useMemo(() => new Animated.Value(1), []);
  const slideAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Salida: Deslizar hacia la izquierda (-40) y desvanecer a 0
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -40,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 2. Alternar entre efectivo y transferencia
        setMetricsMode((prev) => (prev === 'cash' ? 'transfer' : 'cash'));
        
        // Colocar la tarjeta a la derecha (40) antes de que entre
        slideAnim.setValue(40);
        
        // 3. Entrada: Deslizar de regreso a 0 y desvanecer a 1
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 4500); // Rota cada 4.5 segundos

    return () => clearInterval(interval);
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      const tenantId = user?.tenant_id || 'local';
      const [nextProductsCount, pendingOperations, nextDailySummary, nextLowStock] =
        await Promise.all([
          getProductsCount(db, tenantId),
          listPendingSyncOperations(db),
          getDailySalesSummary(db, tenantId),
          getLowStockProducts(db, 5, tenantId),
        ]);

      if (!mounted) return;

      setProductsCount(nextProductsCount);
      setPendingSyncCount(pendingOperations.length);
      setDailySummary(nextDailySummary);
      setLowStock(nextLowStock);

      // Cargar metadatos comerciales locales de SQLite
      if (user?.tenant_id) {
        try {
          const cachedName = await getAppMeta<string>(db, `tenant_${user.tenant_id}`);
          if (cachedName && mounted) {
            setStoreName(cachedName);
          }
          
          const cachedLogo = await getAppMeta<string>(db, `tenant_logo_${user.tenant_id}`);
          if (cachedLogo && mounted) {
            setLogoUri(cachedLogo);
          } else if (mounted) {
            setLogoUri(null);
          }
        } catch (e) {
          console.error('[HOME] Error cargando logo/nombre comercial:', e);
        }
      }
    }

    loadSummary().catch(() => {
      if (mounted) {
        setProductsCount(0);
        setPendingSyncCount(0);
      }
    });

    return () => {
      mounted = false;
    };
  }, [db, user?.tenant_id]);

  const userName = user?.name || 'Usuario';
  const greeting = getGreeting();
  const formattedDate = getFormattedDate();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header con saludo y avatar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {(logoUri || storeName) && (
              <View style={styles.storeHeaderBadge}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.headerStoreLogo} />
                ) : (
                  <Ionicons name="storefront" size={12} color={colors.primary} />
                )}
                <Text style={styles.headerStoreName} numberOfLines={1}>
                  {storeName || 'Mi Comercio'}
                </Text>
              </View>
            )}
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(userName)}</Text>
          </View>
        </View>

        {/* Estado del sistema */}
        <View style={styles.statusRow}>
          <Badge
            label={
              status === 'synced'
                ? 'Sistema operativo'
                : status === 'syncing'
                  ? 'Sincronizando...'
                  : status === 'offline'
                    ? 'Modo Offline'
                    : 'Error de sync'
            }
            variant={
              status === 'synced'
                ? 'success'
                : status === 'syncing'
                  ? 'info'
                  : status === 'offline'
                    ? 'warning'
                    : 'danger'
            }
            size="md"
          />
          {pendingSyncCount > 0 && (
            <Badge label={`${pendingSyncCount} pendientes`} variant="warning" />
          )}
        </View>

        {/* Métricas del día */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumen de hoy</Text>
        </View>
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Ingresos"
            value={`$${dailySummary.sales_total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon="wallet-outline"
          />
          <MetricCard
            label="Ventas"
            value={String(dailySummary.transaction_count)}
            icon="receipt-outline"
          />
        </View>
        <View style={styles.metricsGrid}>
          <View style={{ flex: 1 }}>
            <MetricCard
              label="Productos"
              value={String(productsCount)}
              icon="cube-outline"
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              label={metricsMode === 'cash' ? 'Efectivo' : 'Transferencia'}
              value={
                metricsMode === 'cash'
                  ? `$${dailySummary.cash_total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : `$${dailySummary.transfer_total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              }
              icon={metricsMode === 'cash' ? 'cash-outline' : 'card-outline'}
              animatedStyle={{
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              }}
            />
          </View>
        </View>

        {/* Alertas de stock bajo */}
        {lowStock.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Stock Crítico</Text>
              <Badge label={`${lowStock.length}`} variant="warning" />
            </View>
            <View style={styles.lowStockCard}>
              {lowStock.slice(0, 3).map((product) => (
                <View key={product.id} style={styles.lowStockRow}>
                  <View style={styles.lowStockInfo}>
                    <Text style={styles.lowStockName} numberOfLines={1}>
                      {product.name}
                    </Text>
                  </View>
                  <Badge
                    label={`${product.stock} ${product.unit}`}
                    variant={product.stock <= 0 ? 'danger' : 'warning'}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Acciones rápidas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Acciones</Text>
        </View>

        {!isCashier && (
          <ActionCard
            label="Reportes y Estadísticas"
            description="Ventas del día, stock bajo y caja"
            icon="bar-chart-outline"
            onPress={() => onNavigate('reports')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: spacing.xl,
      paddingBottom: 130, // espacio seguro sobre la pill flotante
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    headerLeft: {
      flex: 1,
      gap: 2,
    },
    storeHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.md,
      alignSelf: 'flex-start',
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerStoreLogo: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      resizeMode: 'contain',
    },
    headerStoreName: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      maxWidth: 160,
    },
    greeting: {
      color: colors.textMuted,
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
    },
    userName: {
      color: colors.text,
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.bold,
      lineHeight: 34,
    },
    dateText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      marginTop: 4,
      textTransform: 'capitalize',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      backgroundColor: isDark ? '#18181b' : '#f4f4f5',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
    },
    statusRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
    },
    metricsGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    lowStockCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    lowStockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lowStockInfo: {
      flex: 1,
      paddingRight: spacing.sm,
    },
    lowStockName: {
      color: colors.text,
      fontSize: fontSize.base,
      fontWeight: fontWeight.bold,
    },
  });
