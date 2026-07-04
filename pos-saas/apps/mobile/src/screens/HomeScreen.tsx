import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionCard } from '../components/ActionCard';
import { MetricCard } from '../components/MetricCard';
import { Badge } from '../components/ui/Badge';
import {
  getProductsCount,
  listPendingSyncOperations,
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
          <MetricCard
            label="Productos"
            value={String(productsCount)}
            icon="cube-outline"
          />
          <MetricCard
            label="Efectivo"
            value={`$${dailySummary.cash_total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon="cash-outline"
          />
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
      paddingBottom: 120, // espacio seguro sobre la pill flotante
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
