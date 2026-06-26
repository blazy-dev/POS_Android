import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { ActionCard } from "../components/ActionCard";
import { MetricCard } from "../components/MetricCard";
import { ModuleChip } from "../components/ModuleChip";
import { Section } from "../components/Section";
import { getProductsCount, getSalesCount, listPendingSyncOperations } from "../database";
import { radius, spacing, ThemeColors } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

interface HomeScreenProps {
  onNavigate: (route: string) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const isCashier = user?.role === "cashier";
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [productsCount, setProductsCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      const tenantId = user?.tenant_id || "local";
      const [nextProductsCount, nextSalesCount, pendingOperations] = await Promise.all([
        getProductsCount(db, tenantId),
        getSalesCount(db, tenantId),
        listPendingSyncOperations(db),
      ]);

      if (!mounted) {
        return;
      }

      setProductsCount(nextProductsCount);
      setSalesCount(nextSalesCount);
      setPendingSyncCount(pendingOperations.length);
    }

    loadSummary().catch(() => {
      if (mounted) {
        setProductsCount(0);
        setSalesCount(0);
        setPendingSyncCount(0);
      }
    });

    return () => {
      mounted = false;
    };
  }, [db, user?.tenant_id]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>POS SaaS Android-First</Text>
            <Text style={styles.title}>La caja del comercio, en el teléfono.</Text>
            <Text style={styles.subtitle}>
              Offline-first, con ventas rápidas, inventario local y sincronización automática.
            </Text>
          </View>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Listo para operar</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Flujo principal</Text>
          <Text style={styles.heroFlow}>Escanear → Cobrar → Imprimir</Text>
          <Text style={styles.heroCopy}>
            Diseñado para lector USB o Bluetooth, con venta local incluso sin internet.
          </Text>

          <View style={styles.heroMetrics}>
            <MetricCard label="Productos" value={String(productsCount)} />
            <MetricCard label="Ventas" value={String(salesCount)} />
            <MetricCard label="Sync" value={String(pendingSyncCount)} />
          </View>
        </View>

        <Section title="Acciones rápidas">
          <ActionCard
            label="Abrir caja / Vender"
            description="Ir al punto de venta y caja"
            onPress={() => onNavigate("sales")}
          />
          <ActionCard
            label={isCashier ? "Catálogo de Productos" : "Nuevo producto"}
            description={isCashier ? "Buscar y ver precios y stock" : "Alta manual o por código"}
            onPress={() => onNavigate("products")}
          />
          {!isCashier && (
            <ActionCard
              label="Reportes y Estadísticas"
              description="Ventas del día, stock bajo y caja"
              onPress={() => onNavigate("reports")}
            />
          )}
        </Section>

        <Section title="Módulos base">
          <View style={styles.moduleGrid}>
            <ModuleChip label="Autenticación" />
            <ModuleChip label="Productos" />
            <ModuleChip label="Inventario" />
            <ModuleChip label="Ventas" />
            <ModuleChip label="Caja" />
            <ModuleChip label="Sincronización" />
          </View>
        </Section>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Siguiente paso técnico</Text>
          <Text style={styles.footerText}>
            Definir navegación base, persistencia SQLite y cola local de sincronización.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 20,
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -140,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(33, 150, 243, 0.16)" : "rgba(4, 151, 191, 0.08)",
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(22, 184, 137, 0.12)" : "rgba(1, 203, 99, 0.06)",
  },
  header: {
    gap: 16,
  },
  kicker: {
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    maxWidth: 320,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(122, 230, 179, 0.12)" : "rgba(1, 203, 99, 0.08)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(122, 230, 179, 0.22)" : "rgba(1, 203, 99, 0.18)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    color: isDark ? "#D9F9EA" : colors.success,
    fontSize: 13,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: isDark ? "rgba(11, 23, 39, 0.88)" : colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: isDark ? "rgba(138, 199, 255, 0.16)" : colors.border,
    gap: 12,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    }),
  },
  heroLabel: {
    color: colors.primary,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  heroFlow: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  footerCard: {
    marginTop: 4,
    backgroundColor: isDark ? "rgba(7, 17, 31, 0.92)" : colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.03,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    }),
  },
  footerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});