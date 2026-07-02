import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { radius, spacing, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  getDailySalesSummary,
  getTopSellingProducts,
  getLowStockProducts,
  getCashRegisterSessions,
  getSessionSalesWithItems,
  DailySalesSummary,
  TopProductRecord,
  LowStockProductRecord,
  CashRegisterSessionRecord,
  SaleWithItems,
} from '../modules/reports';

interface ReportsScreenProps {
  onNavigate: (route: string) => void;
}

type TabKey = 'sales' | 'cash' | 'stock';

export function ReportsScreen({ onNavigate }: ReportsScreenProps) {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [activeTab, setActiveTab] = useState<TabKey>('sales');
  const [loading, setLoading] = useState(true);

  // Estados de los datos del reporte
  const [summary, setSummary] = useState<DailySalesSummary>({
    transaction_count: 0,
    cash_total: 0,
    transfer_total: 0,
    sales_total: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProductRecord[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProductRecord[]>([]);
  const [sessions, setSessions] = useState<CashRegisterSessionRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para expandir las sesiones de caja y ver el desglose de ventas
  const [sessionSales, setSessionSales] = useState<
    Record<string, SaleWithItems[]>
  >({});
  const [expandedSessions, setExpandedSessions] = useState<
    Record<string, boolean>
  >({});

  const tenantId = user?.tenant_id || 'local';

  async function toggleSessionExpand(sessionId: string) {
    const isExpanded = !!expandedSessions[sessionId];
    if (!isExpanded && !sessionSales[sessionId]) {
      try {
        const sales = await getSessionSalesWithItems(db, sessionId);
        setSessionSales((prev) => ({ ...prev, [sessionId]: sales }));
      } catch (err) {
        console.error('Error al cargar ventas del turno:', err);
      }
    }
    setExpandedSessions((prev) => ({ ...prev, [sessionId]: !isExpanded }));
  }

  async function loadReports() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [nextSummary, nextTopProducts, nextLowStock, nextSessions] =
        await Promise.all([
          getDailySalesSummary(db, tenantId),
          getTopSellingProducts(db, 5, tenantId),
          getLowStockProducts(db, 5, tenantId), // Umbral de <= 5 unidades
          getCashRegisterSessions(db, 20, tenantId),
        ]);

      setSummary(nextSummary);
      setTopProducts(nextTopProducts);
      setLowStock(nextLowStock);
      setSessions(nextSessions);
    } catch (err) {
      console.error('Error al cargar reportes:', err);
      setErrorMsg('No se pudieron cargar los datos del reporte local.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [db, activeTab, tenantId]); // Recarga al cambiar de pestaña para refrescar datos

  // Determina la cantidad máxima de productos vendidos para la barra de progreso
  const maxSoldQuantity =
    topProducts.length > 0
      ? Math.max(...topProducts.map((p) => p.total_quantity))
      : 1;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Compilando reportes locales...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => onNavigate('home')} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Volver a Inicio</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.kicker}>Fase 7 — Reportes</Text>
        <Text style={styles.title}>Auditoría y Estadísticas</Text>
        <Text style={styles.subtitle}>
          Visualización en tiempo real del rendimiento de tu negocio offline.
        </Text>
      </View>

      {/* Selector de pestañas segmentado */}
      <View style={styles.tabSelector}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'sales' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('sales')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'sales' && styles.tabButtonTextActive,
            ]}
          >
            Ventas del Día
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'cash' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('cash')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'cash' && styles.tabButtonTextActive,
            ]}
          >
            Historial de Caja
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'stock' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('stock')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'stock' && styles.tabButtonTextActive,
            ]}
          >
            Stock Bajo ({lowStock.length})
          </Text>
        </Pressable>
      </View>

      {errorMsg ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- PESTAÑA A: VENTAS DEL DÍA --- */}
        {activeTab === 'sales' ? (
          <View style={styles.tabContent}>
            {/* Tarjetas métricas */}
            <View style={styles.heroMetricsCard}>
              <Text style={styles.metricLabel}>Total Vendido (Hoy)</Text>
              <Text style={styles.metricHeroValue}>
                $ {summary.sales_total.toFixed(2)}
              </Text>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricMiniCard}>
                <Text style={styles.metricMiniLabel}>Efectivo</Text>
                <Text
                  style={[styles.metricMiniValue, { color: colors.success }]}
                >
                  $ {summary.cash_total.toFixed(2)}
                </Text>
              </View>

              <View style={styles.metricMiniCard}>
                <Text style={styles.metricMiniLabel}>Transferencia</Text>
                <Text
                  style={[styles.metricMiniValue, { color: colors.primary }]}
                >
                  $ {summary.transfer_total.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.metricMiniCardFull}>
              <View style={styles.rowBetween}>
                <Text style={styles.metricMiniLabel}>
                  Transacciones completadas:
                </Text>
                <Text style={styles.metricTxCount}>
                  {summary.transaction_count} ticket(s)
                </Text>
              </View>
            </View>

            {/* Listado de más vendidos */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                Productos Más Vendidos (Top 5)
              </Text>
              <Text style={styles.sectionSubtitle}>
                Ordenados por cantidad de unidades vendidas acumuladas.
              </Text>

              {topProducts.length === 0 ? (
                <Text style={styles.emptyText}>
                  No hay ventas registradas aún.
                </Text>
              ) : (
                <View style={styles.topProductsList}>
                  {topProducts.map((item) => {
                    const widthPercent = `${Math.max(12, (item.total_quantity / maxSoldQuantity) * 100)}%`;
                    return (
                      <View key={item.id} style={styles.topProductRow}>
                        <View style={styles.topProductHeader}>
                          <Text style={styles.topProductName}>{item.name}</Text>
                          <Text style={styles.topProductQty}>
                            {item.total_quantity} {item.unit}
                          </Text>
                        </View>
                        {/* Barra de progreso visual */}
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: widthPercent as any },
                            ]}
                          />
                        </View>
                        <Text style={styles.topProductRevenue}>
                          Recaudado: $ {item.total_amount.toFixed(2)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* --- PESTAÑA B: HISTORIAL DE CAJA --- */}
        {activeTab === 'cash' ? (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Historial de Turnos de Caja</Text>
            <Text style={styles.sectionSubtitle}>
              Últimas 20 sesiones de apertura y cierre de caja.
            </Text>

            {sessions.length === 0 ? (
              <Text style={styles.emptyText}>
                No hay sesiones de caja registradas.
              </Text>
            ) : (
              <View style={styles.timeline}>
                {sessions.map((item) => {
                  const isOpen = item.status === 'open';
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.timelineCard,
                        isOpen && styles.timelineCardOpen,
                      ]}
                    >
                      <View style={styles.timelineHeader}>
                        <View>
                          <Text style={styles.timelineTitle}>
                            Sesión: {item.id.substring(0, 8)}...
                          </Text>
                          <Text style={styles.timelineUser}>
                            Operador: {item.opened_by_name ?? 'Desconocido'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            isOpen
                              ? styles.statusBadgeOpen
                              : styles.statusBadgeClosed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isOpen
                                ? styles.statusBadgeTextOpen
                                : styles.statusBadgeTextClosed,
                            ]}
                          >
                            {isOpen ? 'Abierta' : 'Cerrada'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.timelineDetails}>
                        <View style={styles.timelineDetailRow}>
                          <Text style={styles.timelineLabel}>Apertura:</Text>
                          <Text style={styles.timelineValue}>
                            {new Date(item.opened_at).toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.timelineDetailRow}>
                          <Text style={styles.timelineLabel}>
                            Monto Inicial:
                          </Text>
                          <Text style={styles.timelineValue}>
                            $ {item.opening_amount.toFixed(2)}
                          </Text>
                        </View>

                        {!isOpen && item.closed_at ? (
                          <>
                            <View style={styles.timelineDetailRow}>
                              <Text style={styles.timelineLabel}>Cierre:</Text>
                              <Text style={styles.timelineValue}>
                                {new Date(item.closed_at).toLocaleString()}
                              </Text>
                            </View>
                            <View style={styles.timelineDetailRow}>
                              <Text style={styles.timelineLabel}>
                                Arqueo de Cierre:
                              </Text>
                              <Text
                                style={[
                                  styles.timelineValue,
                                  { color: colors.primary },
                                ]}
                              >
                                $ {item.closing_amount?.toFixed(2)}
                              </Text>
                            </View>
                          </>
                        ) : null}
                      </View>

                      {/* Botón para expandir y ver ventas de la sesión */}
                      <View style={styles.timelineActions}>
                        <Pressable
                          style={styles.expandSalesBtn}
                          onPress={() => toggleSessionExpand(item.id)}
                        >
                          <Text style={styles.expandSalesBtnText}>
                            {expandedSessions[item.id]
                              ? '▲ Ocultar desglose de ventas'
                              : '▼ Ver desglose de ventas'}
                          </Text>
                        </Pressable>
                      </View>

                      {/* Lista de ventas detalladas (Comprobante / Desglose) */}
                      {expandedSessions[item.id] ? (
                        <View style={styles.sessionSalesContainer}>
                          <Text style={styles.salesHeaderTitle}>
                            Desglose de Ventas (Tickets)
                          </Text>
                          {!sessionSales[item.id] ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                              style={{ marginVertical: 12 }}
                            />
                          ) : sessionSales[item.id].length === 0 ? (
                            <Text style={styles.noSalesText}>
                              No se registraron ventas en esta sesión.
                            </Text>
                          ) : (
                            <View style={styles.sessionSalesList}>
                              {sessionSales[item.id].map((sale) => (
                                <View key={sale.id} style={styles.saleItemCard}>
                                  <View style={styles.saleItemHeader}>
                                    <Text style={styles.saleItemPayMethod}>
                                      {sale.payment_method === 'cash'
                                        ? '💵 Efectivo'
                                        : '💳 Transferencia'}
                                    </Text>
                                    <Text style={styles.saleItemTime}>
                                      {new Date(
                                        sale.created_at,
                                      ).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </Text>
                                    <Text style={styles.saleItemTotal}>
                                      $ {sale.total.toFixed(2)}
                                    </Text>
                                  </View>

                                  <View style={styles.saleItemDetails}>
                                    {sale.items.map((prod, idx) => (
                                      <Text
                                        key={idx}
                                        style={styles.saleDetailProductRow}
                                      >
                                        • {prod.product_name} x {prod.quantity}{' '}
                                        {prod.product_unit} · $
                                        {prod.unit_price.toFixed(2)} = $
                                        {prod.subtotal.toFixed(2)}
                                      </Text>
                                    ))}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* --- PESTAÑA C: ALERTAS DE STOCK BAJO --- */}
        {activeTab === 'stock' ? (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>
              Alertas de Existencias Críticas
            </Text>
            <Text style={styles.sectionSubtitle}>
              Productos activos con stock igual o inferior a 5 unidades.
            </Text>

            {lowStock.length === 0 ? (
              <View style={styles.stockSuccessCard}>
                <Text style={styles.stockSuccessText}>
                  ✓ Todo el inventario tiene stock saludable.
                </Text>
              </View>
            ) : (
              <View style={styles.stockList}>
                {lowStock.map((item) => {
                  const isZero = item.stock <= 0;
                  return (
                    <View
                      key={item.id}
                      style={[styles.stockCard, isZero && styles.stockCardZero]}
                    >
                      <View style={styles.stockInfo}>
                        <Text style={styles.stockName}>{item.name}</Text>
                        <Text style={styles.stockPrice}>
                          Precio Venta: $ {item.sale_price.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.stockValueContainer}>
                        <Text
                          style={[
                            styles.stockValue,
                            isZero
                              ? styles.stockValueZero
                              : styles.stockValueLow,
                          ]}
                        >
                          {item.stock}
                        </Text>
                        <Text style={styles.stockUnit}>{item.unit}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    loadingArea: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      paddingHorizontal: spacing.xl,
      paddingTop: 12,
    },
    backLink: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    backLinkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      gap: 6,
    },
    kicker: {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      fontSize: 11,
      fontWeight: '800',
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    tabSelector: {
      flexDirection: 'row',
      paddingHorizontal: spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? 'rgba(7, 17, 31, 0.3)' : colors.surfaceSoft,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabButtonActive: {
      borderBottomColor: colors.primary,
    },
    tabButtonText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    tabButtonTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    errorCard: {
      margin: spacing.xl,
      padding: spacing.md,
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.1)'
        : 'rgba(211, 47, 47, 0.08)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.2)'
        : 'rgba(211, 47, 47, 0.18)',
    },
    errorText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
    },
    scrollContainer: {
      padding: spacing.xl,
      paddingBottom: 40,
    },
    tabContent: {
      gap: spacing.lg,
    },
    heroMetricsCard: {
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.04)'
        : colors.surfaceCard,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: 6,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    metricHeroValue: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '800',
    },
    metricsGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    metricMiniCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.lg,
      gap: 4,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }),
    },
    metricMiniCardFull: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.lg,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }),
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metricMiniLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    metricMiniValue: {
      fontSize: 18,
      fontWeight: '800',
    },
    metricTxCount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 4,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    sectionSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 8,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 20,
    },
    topProductsList: {
      gap: 14,
      marginTop: 8,
    },
    topProductRow: {
      gap: 6,
    },
    topProductHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topProductName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    topProductQty: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    progressBarBg: {
      height: 6,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.06)'
        : 'rgba(0, 0, 0, 0.06)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    topProductRevenue: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'right',
    },
    timeline: {
      gap: spacing.md,
    },
    timelineCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 12,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    timelineCardOpen: {
      borderColor: isDark
        ? 'rgba(122, 230, 179, 0.22)'
        : 'rgba(1, 203, 99, 0.22)',
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.02)'
        : 'rgba(1, 203, 99, 0.02)',
    },
    timelineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    timelineTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    timelineUser: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusBadgeOpen: {
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.12)'
        : 'rgba(1, 203, 99, 0.12)',
    },
    statusBadgeClosed: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.06)'
        : colors.surfaceSoft,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    statusBadgeTextOpen: {
      color: colors.success,
    },
    statusBadgeTextClosed: {
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    timelineDetails: {
      gap: 8,
    },
    timelineDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timelineLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
    timelineValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    stockSuccessCard: {
      padding: spacing.xl,
      borderRadius: radius.lg,
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.08)'
        : 'rgba(1, 203, 99, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(122, 230, 179, 0.18)'
        : 'rgba(1, 203, 99, 0.18)',
      alignItems: 'center',
    },
    stockSuccessText: {
      color: colors.success,
      fontSize: 14,
      fontWeight: '700',
    },
    stockList: {
      gap: spacing.md,
    },
    stockCard: {
      backgroundColor: colors.surface,
      borderColor: isDark
        ? 'rgba(255, 192, 105, 0.18)'
        : 'rgba(230, 126, 34, 0.18)',
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }),
    },
    stockCardZero: {
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.22)'
        : 'rgba(211, 47, 47, 0.22)',
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.02)'
        : 'rgba(211, 47, 47, 0.02)',
    },
    stockInfo: {
      gap: 4,
      flex: 1,
    },
    stockName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    stockPrice: {
      color: colors.textMuted,
      fontSize: 12,
    },
    stockValueContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 48,
    },
    stockValue: {
      fontSize: 20,
      fontWeight: '800',
    },
    stockValueLow: {
      color: isDark ? '#FFC069' : '#E67E22',
    },
    stockValueZero: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
    },
    stockUnit: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      textTransform: 'uppercase',
    },
    timelineActions: {
      marginTop: 8,
      alignItems: 'flex-end',
    },
    expandSalesBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.08)'
        : 'rgba(4, 151, 191, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.18)'
        : 'rgba(4, 151, 191, 0.18)',
    },
    expandSalesBtnText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    sessionSalesContainer: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    salesHeaderTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    noSalesText: {
      color: colors.textMuted,
      fontSize: 12,
      fontStyle: 'italic',
      paddingVertical: 8,
    },
    sessionSalesList: {
      gap: 10,
    },
    saleItemCard: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      gap: 6,
    },
    saleItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    saleItemPayMethod: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
    },
    saleItemTime: {
      color: colors.textMuted,
      fontSize: 11,
      marginRight: 10,
    },
    saleItemTotal: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '800',
    },
    saleItemDetails: {
      gap: 4,
      paddingLeft: 6,
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
    },
    saleDetailProductRow: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
  });
