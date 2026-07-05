import { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../context/ThemeContext';
import { getAppMeta, setAppMeta, enqueueSyncOperation } from '../database';
import { Badge } from '../components/ui/Badge';
import { ThemeColors, radius, spacing, fontSize, fontWeight } from '../theme/tokens';
import { createLocalId } from '../utils/ids';

interface LicenseAdminScreenProps {
  onClose: () => void;
}

interface TenantItem {
  id: string;
  name: string;
  ownerEmail?: string;
  status: 'demo' | 'active' | 'expired';
  endsAt: number;
}

const ITEMS_PER_PAGE = 15;

export function LicenseAdminScreen({ onClose }: LicenseAdminScreenProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // Carga inicial de comercios registrados en SQLite
  async function loadTenants() {
    try {
      setLoading(true);
      
      // En un modelo offline-first, obtenemos todos los tenants únicos que tienen transacciones o usuarios locales
      const dbTenants = await db.getAllAsync<{ tenant_id: string }>(
        `SELECT DISTINCT tenant_id FROM users`
      );

      const items: TenantItem[] = [];

      for (const row of dbTenants) {
        const tId = row.tenant_id;
        
        // Obtener metadatos locales de cada tenant
        const name = await getAppMeta<string>(db, `tenant_${tId}`) || `Comercio #${tId.substring(0, 6)}`;
        const email = await getAppMeta<string>(db, `tenant_owner_email_${tId}`) || 'Sin email registrado';
        const status = (await getAppMeta<string>(db, `tenant_subscription_status_${tId}`)) as any || 'demo';
        const endsAtStr = await getAppMeta<string>(db, `tenant_subscription_ends_at_${tId}`);
        const endsAt = endsAtStr ? parseInt(endsAtStr, 10) : 0;

        items.push({
          id: tId,
          name,
          ownerEmail: email,
          status,
          endsAt,
        });
      }

      setTenants(items);
    } catch (err) {
      console.error('[ADMIN] Error al cargar comercios locales:', err);
      Alert.alert('Error', 'No se pudieron cargar los comercios registrados en el dispositivo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  // Resetear la paginación al realizar búsquedas
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  // Filtrar lista de comercios según búsqueda
  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter(
      (t) => t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query)
    );
  }, [tenants, searchQuery]);

  // Paginación local de 15 comercios por página
  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE);
  
  const paginatedTenants = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return filteredTenants.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTenants, currentPage]);

  // Sumar 30 días de suscripción a un comercio específico
  async function handleAdd30Days(tenant: TenantItem) {
    try {
      setLoading(true);
      const now = Date.now();
      
      // Calcular nueva fecha: si ya venció, se calcula desde hoy. Si no, se extiende la existente.
      const currentEndsAt = tenant.endsAt;
      const baseTime = currentEndsAt > now ? currentEndsAt : now;
      const newEndsAt = baseTime + 30 * 24 * 60 * 60 * 1000;

      // Guardar localmente en SQLite
      await setAppMeta(db, `tenant_subscription_status_${tenant.id}`, 'active');
      await setAppMeta(db, `tenant_subscription_ends_at_${tenant.id}`, String(newEndsAt));

      // Encolar actualización para el backend
      const syncId = createLocalId('sync');
      await enqueueSyncOperation(db, {
        id: syncId,
        entityType: 'tenant_subscription',
        entityId: tenant.id,
        kind: 'update',
        payload: {
          tenantId: tenant.id,
          status: 'active',
          endsAt: newEndsAt,
        },
      });

      Alert.alert(
        'Licencia Actualizada',
        `Se extendió la suscripción de "${tenant.name}" por 30 días.\n` +
        `Nuevo vencimiento: ${new Date(newEndsAt).toLocaleDateString('es-AR')}`
      );

      // Recargar lista
      void loadTenants();
    } catch (err) {
      console.error('[ADMIN] Error al extender licencia:', err);
      Alert.alert('Error', 'No se pudo actualizar la licencia.');
    } finally {
      setLoading(false);
    }
  }

  // Activar licencia permanente (ilimitada)
  async function handleActivatePermanently(tenant: TenantItem) {
    Alert.alert(
      'Activar Permanente',
      `¿Confirmás la activación permanente e ilimitada para "${tenant.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setLoading(true);
              const infinityEndsAt = 4102444800000; // Año 2100

              await setAppMeta(db, `tenant_subscription_status_${tenant.id}`, 'active');
              await setAppMeta(db, `tenant_subscription_ends_at_${tenant.id}`, String(infinityEndsAt));

              // Encolar sync
              const syncId = createLocalId('sync');
              await enqueueSyncOperation(db, {
                id: syncId,
                entityType: 'tenant_subscription',
                entityId: tenant.id,
                kind: 'update',
                payload: {
                  tenantId: tenant.id,
                  status: 'active',
                  endsAt: infinityEndsAt,
                },
              });

              Alert.alert('Licencia Activada', `"${tenant.name}" posee ahora una licencia completa permanente.`);
              void loadTenants();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'No se pudo activar la licencia permanente.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  // Revertir comercio a versión Demo
  async function handleRevertToDemo(tenant: TenantItem) {
    Alert.alert(
      'Revertir a Demo',
      `¿Confirmás revertir a versión Demo al comercio "${tenant.name}"?\nSe restablecerán los 3 días de trial a partir de hoy.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const now = Date.now();

              // Modificar estados locales en SQLite
              await setAppMeta(db, `tenant_subscription_status_${tenant.id}`, 'demo');
              await setAppMeta(db, `tenant_subscription_ends_at_${tenant.id}`, '0');
              await setAppMeta(db, `tenant_trial_start_${tenant.id}`, String(now));

              // Encolar sync para propagar la reversión a Supabase
              const syncId = createLocalId('sync');
              await enqueueSyncOperation(db, {
                id: syncId,
                entityType: 'tenant_subscription',
                entityId: tenant.id,
                kind: 'update',
                payload: {
                  tenantId: tenant.id,
                  status: 'demo',
                  endsAt: 0,
                  trialStart: now,
                },
              });

              Alert.alert('Éxito', `El comercio "${tenant.name}" fue revertido a versión Demo.`);
              void loadTenants();
            } catch (err) {
              console.error('[ADMIN] Error al revertir a demo:', err);
              Alert.alert('Error', 'No se pudo revertir el comercio a demo.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Licencias POS</Text>
          <Text style={styles.subtitle}>Consola de Administración de Plataforma</Text>
        </View>
        <Pressable onPress={loadTenants} style={styles.syncButton} disabled={loading}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar comercio por nombre o ID..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading && tenants.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {paginatedTenants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No se encontraron comercios registrados</Text>
              </View>
            ) : (
              paginatedTenants.map((tenant) => {
                const endsAtDate = tenant.endsAt > 0 ? new Date(tenant.endsAt) : null;
                const isExpired = tenant.status === 'expired' || (tenant.endsAt > 0 && tenant.endsAt < Date.now() && tenant.endsAt < 4102444800000);
                
                return (
                  <View key={tenant.id} style={styles.tenantCard}>
                    <View style={styles.tenantHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tenantName}>{tenant.name}</Text>
                        <Text style={styles.tenantId} numberOfLines={1}>ID: {tenant.id}</Text>
                      </View>
                      
                      <Badge
                        variant={isExpired ? 'danger' : tenant.status === 'active' ? 'success' : 'warning'}
                        label={isExpired ? 'Expirado' : tenant.status === 'active' ? 'Completo' : 'Demo'}
                      />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailsBlock}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Contacto Propietario:</Text>
                        <Text style={styles.infoValue}>{tenant.ownerEmail}</Text>
                      </View>
                      
                      {endsAtDate && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Vencimiento Licencia:</Text>
                          <Text style={styles.infoValue}>
                            {tenant.endsAt > 4102444800000 ? 'Permanente / Completa' : endsAtDate.toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => handleAdd30Days(tenant)}
                        disabled={loading}
                      >
                        <Ionicons name="calendar-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.actionButtonText}>Sumar 30 días</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionButton, styles.actionButtonSecondary]}
                        onPress={() => handleActivatePermanently(tenant)}
                        disabled={loading}
                      >
                        <Ionicons name="infinite-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.actionButtonSecondaryText}>Permanente</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionButton, styles.actionButtonDanger]}
                        onPress={() => handleRevertToDemo(tenant)}
                        disabled={loading}
                      >
                        <Ionicons name="refresh-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionButtonText}>Demo</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}

            {/* Componente de Navegación de Paginación */}
            {totalPages > 1 && (
              <View style={styles.paginationRow}>
                <Pressable
                  style={[styles.paginationBtn, currentPage === 0 && styles.paginationBtnDisabled]}
                  onPress={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  <Ionicons name="chevron-back" size={18} color={currentPage === 0 ? colors.textMuted : colors.primary} />
                  <Text style={[styles.paginationBtnText, currentPage === 0 && styles.paginationBtnTextDisabled]}>Anterior</Text>
                </Pressable>

                <Text style={styles.paginationInfo}>
                  Página {currentPage + 1} de {totalPages}
                </Text>

                <Pressable
                  style={[styles.paginationBtn, currentPage >= totalPages - 1 && styles.paginationBtnDisabled]}
                  onPress={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  <Text style={[styles.paginationBtnText, currentPage >= totalPages - 1 && styles.paginationBtnTextDisabled]}>Siguiente</Text>
                  <Ionicons name="chevron-forward" size={18} color={currentPage >= totalPages - 1 ? colors.textMuted : colors.primary} />
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    backButton: {
      padding: 4,
    },
    headerTitleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    syncButton: {
      padding: 8,
      borderRadius: radius.md,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: spacing.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContainer: {
      padding: spacing.lg,
      paddingBottom: 130, // Padding inferior de 130px de seguridad
      gap: 14,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    tenantCard: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    tenantHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    tenantName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    tenantId: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: colors.textMuted,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    detailsBlock: {
      gap: 6,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    infoValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: 6,
    },
    actionButton: {
      flex: 1.2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    actionButtonSecondary: {
      flex: 1.2,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionButtonSecondaryText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    actionButtonDanger: {
      flex: 0.8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#E28743' : colors.warning,
    },
    paginationRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    paginationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    },
    paginationBtnDisabled: {
      backgroundColor: 'transparent',
      opacity: 0.4,
    },
    paginationBtnText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    paginationBtnTextDisabled: {
      color: colors.textMuted,
    },
    paginationInfo: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
  });
