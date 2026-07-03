import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync, SyncStatus } from '../context/SyncContext';
import { subscribeToLogs, clearSyncLogs, LogEvent } from '../api/client';
import { radius, spacing, fontSize, fontWeight, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/Button';

export function SyncScreen() {
  const {
    status,
    pendingCount,
    lastSyncAt,
    isOfflineMode,
    isServerErrorMode,
    triggerSync,
    setOfflineMode,
    setServerErrorMode,
  } = useSync();

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [logs, setLogs] = useState<LogEvent[]>([]);

  // Suscribirse a los logs en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeToLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return unsubscribe;
  }, []);

  // Formatear estado para visualización
  const getStatusDetails = (s: SyncStatus) => {
    switch (s) {
      case 'synced':
        return {
          label: 'Sincronizado',
          color: colors.success,
          bgColor: isDark
            ? 'rgba(122, 230, 179, 0.08)'
            : 'rgba(1, 203, 99, 0.08)',
          borderColor: isDark
            ? 'rgba(122, 230, 179, 0.18)'
            : 'rgba(1, 203, 99, 0.18)',
        };
      case 'syncing':
        return {
          label: 'Sincronizando...',
          color: colors.primary,
          bgColor: isDark
            ? 'rgba(138, 199, 255, 0.08)'
            : 'rgba(4, 151, 191, 0.08)',
          borderColor: isDark
            ? 'rgba(138, 199, 255, 0.18)'
            : 'rgba(4, 151, 191, 0.18)',
        };
      case 'offline':
        return {
          label: 'Modo Offline',
          color: isDark ? '#FFC069' : '#E67E22',
          bgColor: isDark
            ? 'rgba(255, 192, 105, 0.08)'
            : 'rgba(230, 126, 34, 0.08)',
          borderColor: isDark
            ? 'rgba(255, 192, 105, 0.18)'
            : 'rgba(230, 126, 34, 0.18)',
        };
      case 'error':
        return {
          label: 'Error de sincronización',
          color: isDark ? '#FFB4B4' : '#D32F2F',
          bgColor: isDark
            ? 'rgba(255, 180, 180, 0.08)'
            : 'rgba(211, 47, 47, 0.08)',
          borderColor: isDark
            ? 'rgba(255, 180, 180, 0.18)'
            : 'rgba(211, 47, 47, 0.18)',
        };
    }
  };

  const statusInfo = getStatusDetails(status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Encabezado */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="cloud" size={28} color={isDark ? '#8AC7FF' : colors.primary} />
          </View>
          <Text style={styles.title}>Sincronización</Text>
          <Text style={styles.subtitle}>
            Monitoreá operaciones offline, forzá sincronizaciones y
            simulá estados de red.
          </Text>
        </View>

        {/* Tarjeta de Estado Principal */}
        <View
          style={[
            styles.card,
            {
              borderColor: statusInfo.borderColor,
              backgroundColor: statusInfo.bgColor,
            },
          ]}
        >
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusLabel}>Estado Actual:</Text>
              <Text style={[styles.statusValue, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            {status === 'syncing' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View
                style={[
                  styles.statusIndicatorDot,
                  { backgroundColor: statusInfo.color },
                ]}
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Último Sync Exitoso:</Text>
            <Text style={styles.infoValue}>
              {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Nunca'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Operaciones en Cola Local:</Text>
            <Text
              style={[
                styles.infoValue,
                pendingCount > 0 && styles.pendingHighlight,
              ]}
            >
              {pendingCount} pendiente(s)
            </Text>
          </View>

          <Button
            label={status === 'syncing' ? 'Sincronizando...' : 'Sincronizar Ahora'}
            icon="sync-outline"
            onPress={() => {
              void triggerSync();
            }}
            loading={status === 'syncing'}
            disabled={status === 'syncing'}
          />
        </View>

        {/* Panel de Simulación / Herramientas de Desarrollo */}
        <View style={styles.devCard}>
          <Text style={styles.sectionTitle}>
            Simulador de Conectividad (Demo)
          </Text>
          <Text style={styles.sectionDescription}>
            Usá estos controles para validar el comportamiento offline-first sin
            necesidad de apagar el Wi-Fi del celular.
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Forzar Modo Offline</Text>
              <Text style={styles.switchSubtitle}>
                Desconecta artificialmente el cliente de la API.
              </Text>
            </View>
            <Switch
              value={isOfflineMode}
              onValueChange={setOfflineMode}
              trackColor={{
                false: '#1B2A3E',
                true: 'rgba(138, 199, 255, 0.4)',
              }}
              thumbColor={isOfflineMode ? colors.primary : '#4F647C'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>
                Simular Caída del Servidor (HTTP 500)
              </Text>
              <Text style={styles.switchSubtitle}>
                La API responderá con un error interno para probar los
                reintentos locales.
              </Text>
            </View>
            <Switch
              value={isServerErrorMode}
              onValueChange={setServerErrorMode}
              trackColor={{
                false: '#1B2A3E',
                true: 'rgba(255, 180, 180, 0.4)',
              }}
              thumbColor={isServerErrorMode ? '#FFB4B4' : '#4F647C'}
              disabled={isOfflineMode}
            />
          </View>
        </View>

        {/* Consola de Logs en Tiempo Real */}
        <View style={styles.logsCard}>
          <View style={styles.logsHeader}>
            <Text style={styles.logsSectionTitle}>Registro de Actividad</Text>
            <Pressable onPress={clearSyncLogs} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </Pressable>
          </View>

          {logs.length === 0 ? (
            <View style={styles.emptyLogs}>
              <Text style={styles.emptyLogsText}>
                Sin registros de actividad.
              </Text>
            </View>
          ) : (
            <View style={styles.logsListContainer}>
              {logs.map((item, index) => {
                let textStyle = styles.logInfo;
                if (item.type === 'success') textStyle = styles.logSuccess;
                if (item.type === 'error') textStyle = styles.logError;
                if (item.type === 'warning') textStyle = styles.logWarning;

                return (
                  <View key={index} style={styles.logRow}>
                    <Text style={styles.logTimestamp}>[{item.timestamp}]</Text>
                    <Text style={[styles.logMessage, textStyle]}>
                      {item.message}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
      gap: spacing.lg,
      paddingBottom: 40,
    },
    header: {
      gap: 6,
      marginBottom: 4,
      alignItems: 'center',
    },
    headerIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.08)'
        : 'rgba(4, 151, 191, 0.06)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.16)'
        : 'rgba(4, 151, 191, 0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
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
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    card: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.md,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    statusValue: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 2,
    },
    statusIndicatorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 13,
    },
    infoValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    pendingHighlight: {
      color: colors.primary,
    },
    syncButton: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.18)'
        : 'rgba(4, 151, 191, 0.15)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.22)'
        : 'rgba(4, 151, 191, 0.35)',
      alignItems: 'center',
      marginTop: 4,
    },
    syncButtonDisabled: {
      opacity: 0.6,
    },
    syncButtonText: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    devCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
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
      fontSize: 15,
      fontWeight: '800',
    },
    sectionDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    switchInfo: {
      flex: 1,
      gap: 3,
      paddingRight: 10,
    },
    switchTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    switchSubtitle: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    logsCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: isDark ? 'rgba(7, 17, 31, 0.5)' : colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    logsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logsSectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    clearButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    clearButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    emptyLogs: {
      paddingVertical: 18,
      alignItems: 'center',
    },
    emptyLogsText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    logsListContainer: {
      gap: 8,
      maxHeight: 280,
    },
    logRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start',
    },
    logTimestamp: {
      color: isDark ? '#6C8096' : '#8CA1B3',
      fontSize: 11,
      fontFamily: 'monospace',
    },
    logMessage: {
      flex: 1,
      fontSize: 11,
      lineHeight: 15,
      fontFamily: 'monospace',
    },
    logInfo: {
      color: colors.text,
    },
    logSuccess: {
      color: colors.success,
    },
    logWarning: {
      color: isDark ? '#FFC069' : '#E67E22',
    },
    logError: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
    },
  });
