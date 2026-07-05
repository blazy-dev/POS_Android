import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { radius, spacing, fontSize, fontWeight, shadow, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../api/supabase';
import { apiConfig, getCachedToken } from '../api/client';
import { FormField } from '../components/form/FormField';
import { EmployeeManagementScreen } from './EmployeeManagementScreen';
import { useSQLiteContext } from 'expo-sqlite';
import { getAppMeta, setAppMeta } from '../database';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import * as ImagePicker from 'expo-image-picker';

const CURRENCIES = [
  { value: 'ARS', label: 'ARS ($)', desc: 'Peso Argentino' },
  { value: 'USD', label: 'USD ($)', desc: 'Dólar Estadounidense' },
  { value: 'EUR', label: 'EUR (€)', desc: 'Euro' },
  { value: 'UYU', label: 'UYU ($)', desc: 'Peso Uruguayo' },
  { value: 'CLP', label: 'CLP ($)', desc: 'Peso Chileno' },
];

const TIMEZONES = [
  {
    value: 'America/Argentina/Buenos_Aires',
    label: 'Buenos Aires',
    desc: 'GMT-3',
  },
  { value: 'America/Montevideo', label: 'Montevideo', desc: 'GMT-3' },
  { value: 'America/Santiago', label: 'Santiago', desc: 'GMT-4' },
  { value: 'America/Bogota', label: 'Bogotá / Lima', desc: 'GMT-5' },
  { value: 'America/New_York', label: 'New York', desc: 'GMT-4' },
  { value: 'Europe/Madrid', label: 'Madrid / Barcelona', desc: 'GMT+2' },
];

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { theme, colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const isOnlineUser = user && !user.email.endsWith('@pos.local');
  const isAdmin = user && user.role === 'admin';

  const [tenantInfo, setTenantInfo] = useState<{
    id: string;
    name: string;
    currency: string;
    timezone: string;
  } | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Estados del formulario de edición
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState('ARS');
  const [editTimezone, setEditTimezone] = useState(
    'America/Argentina/Buenos_Aires',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmployees, setShowEmployees] = useState(false);
  const db = useSQLiteContext();
  const [tenantName, setTenantName] = useState<string>('');
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // Obtener datos del comercio
  async function fetchTenantDetails() {
    if (!isOnlineUser) return;
    try {
      setLoadingTenant(true);
      const token = getCachedToken();
      if (!token) return;

      const response = await fetch(`${apiConfig.baseUrl}/auth/tenant`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          setTenantInfo(resData.data);
          setEditName(resData.data.name);
          setEditCurrency(resData.data.currency);
          setEditTimezone(resData.data.timezone);

          if (user?.tenant_id) {
            await setAppMeta(db, `tenant_${user.tenant_id}`, resData.data.name);
            if (resData.data.email) {
              await setAppMeta(
                db,
                `tenant_owner_email_${user.tenant_id}`,
                resData.data.email,
              );
            }
            setTenantName(resData.data.name);
          }
        }
      }
    } catch (err) {
      console.error('Error al obtener datos del comercio:', err);
    } finally {
      setLoadingTenant(false);
    }
  }

  async function handleSelectLogo() {
    if (!user?.tenant_id) return;
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Denegado', 'Se requieren permisos de galería para subir un logo.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setLogoUri(selectedUri);
        await setAppMeta(db, `tenant_logo_${user.tenant_id}`, selectedUri);
        Alert.alert('Éxito', 'El logo se ha actualizado correctamente.');
      }
    } catch (err) {
      console.error('Error al seleccionar imagen del logo:', err);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  }

  async function handleDeleteLogo() {
    if (!user?.tenant_id) return;
    Alert.alert(
      'Eliminar Logo',
      '¿Estás seguro de que quieres quitar el logo de tu comercio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setLogoUri(null);
            await setAppMeta(db, `tenant_logo_${user.tenant_id}`, '');
            Alert.alert('Éxito', 'Se ha eliminado el logo del comercio.');
          }
        }
      ]
    );
  }

  useEffect(() => {
    async function loadCachedData() {
      if (user?.tenant_id) {
        try {
          const cached = await getAppMeta<string>(
            db,
            `tenant_${user.tenant_id}`,
          );
          if (cached) {
            setTenantName(cached);
          }
          
          const cachedLogo = await getAppMeta<string>(
            db,
            `tenant_logo_${user.tenant_id}`,
          );
          if (cachedLogo) {
            setLogoUri(cachedLogo);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setTenantName('');
        setLogoUri(null);
      }
    }
    void loadCachedData();
    void fetchTenantDetails();
  }, [user]);

  // Guardar datos editados del comercio
  async function handleSaveTenant() {
    setErrorMsg(null);
    if (!editName.trim()) {
      setErrorMsg('El nombre comercial es obligatorio.');
      return;
    }

    try {
      setLoadingTenant(true);
      const token = getCachedToken();
      if (!token) return;

      const response = await fetch(`${apiConfig.baseUrl}/auth/tenant`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          currency: editCurrency,
          timezone: editTimezone,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.data) {
          setTenantInfo(resData.data);
          setIsEditing(false);
          if (user?.tenant_id) {
            await setAppMeta(db, `tenant_${user.tenant_id}`, resData.data.name);
            if (resData.data.email) {
              await setAppMeta(
                db,
                `tenant_owner_email_${user.tenant_id}`,
                resData.data.email,
              );
            }
            setTenantName(resData.data.name);
          }
        } else {
          setErrorMsg('Error al guardar la configuración.');
        }
      } else {
        const errText = await response.text();
        setErrorMsg(`Error al guardar: ${errText || response.status}`);
      }
    } catch (err) {
      console.error('Error al guardar datos de comercio:', err);
      setErrorMsg('Error de conexión al guardar.');
    } finally {
      setLoadingTenant(false);
    }
  }

  if (showEmployees) {
    return <EmployeeManagementScreen onBack={() => setShowEmployees(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerWithIcon}>
          <View style={styles.settingsIcon}>
            <Ionicons name="settings" size={24} color={isDark ? '#8AC7FF' : colors.primary} />
          </View>
          <Text style={styles.title}>Ajustes</Text>
          <Text style={styles.subtitle}>
            Configuración del comercio, tema visual y sesión.
          </Text>
        </View>

        {/* Sección Usuario Activo */}
        {user ? (
          <View style={styles.profileCard}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
                <Badge
                  label={
                    user.role === 'admin'
                      ? 'Administrador'
                      : user.role === 'supervisor'
                        ? 'Supervisor'
                        : 'Cajero'
                  }
                  variant={user.role === 'admin' ? 'info' : user.role === 'supervisor' ? 'warning' : 'neutral'}
                />
              </View>
            </View>
            {tenantName ? (
              <View style={styles.tenantRow}>
                <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                <Text style={styles.profileOrg}>{tenantName}</Text>
              </View>
            ) : null}
            <Button
              label="Cerrar Sesión"
              icon="log-out-outline"
              variant="danger"
              onPress={logout}
            />
          </View>
        ) : null}

        {/* Sección Perfil de Comercio (Multi-tenant) */}
        {isOnlineUser && tenantInfo ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Perfil del Comercio</Text>
              {isAdmin && !isEditing && (
                <Pressable onPress={() => setIsEditing(true)}>
                  <Text style={styles.editLink}>Editar perfil</Text>
                </Pressable>
              )}
            </View>

            {loadingTenant && !isEditing ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: 10 }}
              />
            ) : isEditing ? (
              <View style={styles.editForm}>
                <FormField
                  label="Nombre del negocio"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Mi Comercio POS"
                  required
                />

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Moneda de facturación</Text>
                  <View style={styles.optionsGrid}>
                    {CURRENCIES.map((c) => {
                      const active = editCurrency === c.value;
                      return (
                        <Pressable
                          key={c.value}
                          style={[
                            styles.optionChip,
                            active && styles.optionChipActive,
                          ]}
                          onPress={() => setEditCurrency(c.value)}
                        >
                          <Text
                            style={[
                              styles.optionChipLabel,
                              active && styles.optionChipLabelActive,
                            ]}
                          >
                            {c.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Zona Horaria</Text>
                  <View style={styles.optionsGrid}>
                    {TIMEZONES.map((t) => {
                      const active = editTimezone === t.value;
                      return (
                        <Pressable
                          key={t.value}
                          style={[
                            styles.optionChip,
                            active && styles.optionChipActive,
                          ]}
                          onPress={() => setEditTimezone(t.value)}
                        >
                          <Text
                            style={[
                              styles.optionChipLabel,
                              active && styles.optionChipLabelActive,
                            ]}
                          >
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                <View style={styles.editActions}>
                  <Pressable
                    style={[
                      styles.saveButton,
                      loadingTenant && styles.buttonDisabled,
                    ]}
                    onPress={handleSaveTenant}
                    disabled={loadingTenant}
                  >
                    {loadingTenant ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Guardar</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsEditing(false);
                      setErrorMsg(null);
                      setEditName(tenantInfo.name);
                      setEditCurrency(tenantInfo.currency);
                      setEditTimezone(tenantInfo.timezone);
                    }}
                    disabled={loadingTenant}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.tenantDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nombre comercial:</Text>
                  <Text style={styles.detailValue}>{tenantInfo.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Moneda:</Text>
                  <Text style={styles.detailValue}>
                    {CURRENCIES.find((c) => c.value === tenantInfo.currency)
                      ?.desc || tenantInfo.currency}{' '}
                    ({tenantInfo.currency})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Zona Horaria:</Text>
                  <Text style={styles.detailValue}>{tenantInfo.timezone}</Text>
                </View>

                {isAdmin && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.logoUploadSection}>
                      <Text style={styles.logoSectionLabel}>Logo Comercial:</Text>
                      <View style={styles.logoRowContainer}>
                        {logoUri ? (
                          <View style={styles.logoPreviewWrapper}>
                            <Image source={{ uri: logoUri }} style={styles.logoImagePreview} />
                            <Pressable onPress={handleDeleteLogo} style={styles.deleteLogoBadge}>
                              <Ionicons name="close" size={14} color="#ffffff" />
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable onPress={handleSelectLogo} style={styles.logoEmptyPlaceholder}>
                            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                            <Text style={styles.logoEmptyText}>Subir Logo</Text>
                          </Pressable>
                        )}
                        <View style={styles.logoUploadInfo}>
                          <Text style={styles.logoUploadHeading}>Logo del Establecimiento</Text>
                          <Text style={styles.logoUploadDesc}>
                            Se utilizará para personalizar las etiquetas impresas y el encabezado de inicio.
                          </Text>
                          {logoUri && (
                            <Pressable onPress={handleSelectLogo} style={styles.changeLogoLink}>
                              <Text style={styles.changeLogoLinkText}>Cambiar imagen</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        ) : null}

        {/* Sección Gestion de Empleados (siempre visible para admin) */}
        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gestión de Personal</Text>
            <Text style={styles.cardText}>
              Administrá cajeros, supervisores y sus credenciales de acceso
              local.
            </Text>
            <Pressable
              style={styles.manageEmployeesButton}
              onPress={() => setShowEmployees(true)}
            >
              <Text style={styles.manageEmployeesButtonText}>
                👥 Gestionar Empleados
              </Text>
            </Pressable>
          </View>
        )}

        {/* Sección Apariencia */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apariencia</Text>
          <Text style={styles.cardText}>
            Elegí el tema visual de la aplicación:
          </Text>

          <View style={styles.themeSelectorRow}>
            <Pressable
              style={[
                styles.themeButton,
                theme === 'light' && styles.themeButtonActive,
              ]}
              onPress={() => {
                void toggleTheme();
              }}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  theme === 'light' && styles.themeButtonTextActive,
                ]}
              >
                ☀️ Claro
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.themeButton,
                theme === 'dark' && styles.themeButtonActive,
              ]}
              onPress={() => {
                void toggleTheme();
              }}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  theme === 'dark' && styles.themeButtonTextActive,
                ]}
              >
                🌙 Oscuro
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Sección Próximos Bloques */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Próximos bloques</Text>
          <Text style={styles.cardText}>Dispositivos vinculados</Text>
          <Text style={styles.cardText}>Impresora térmica y periféricos</Text>
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
      padding: 20,
      paddingBottom: 130, // espacio seguro sobre la pill flotante
      gap: 12,
    },
    kicker: {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      fontSize: 12,
      fontWeight: '700',
    },
    headerWithIcon: {
      alignItems: 'center',
      gap: 6,
    },
    settingsIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
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
    title: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
    card: {
      marginTop: 12,
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    editLink: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    cardText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    profileCard: {
      marginTop: 12,
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    profileHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    profileAvatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.14)'
        : 'rgba(4, 151, 191, 0.10)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.22)'
        : 'rgba(4, 151, 191, 0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileAvatarText: {
      color: isDark ? '#8AC7FF' : colors.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    profileInfo: {
      flex: 1,
      gap: 4,
    },
    tenantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    profileName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    profileRole: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    profileEmail: {
      color: colors.textMuted,
      fontSize: 13,
    },
    profileOrg: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    logoutButton: {
      marginTop: 6,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 77, 77, 0.3)' : 'rgba(211, 47, 47, 0.3)',
      backgroundColor: isDark
        ? 'rgba(255, 77, 77, 0.04)'
        : 'rgba(211, 47, 47, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutButtonText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 14,
      fontWeight: '700',
    },
    themeSelectorRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: 6,
    },
    themeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.12)'
        : 'rgba(4, 151, 191, 0.08)',
    },
    themeButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    themeButtonTextActive: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontWeight: '800',
    },
    tenantDetails: {
      gap: 8,
      marginTop: 4,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    detailValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    editForm: {
      gap: 14,
      marginTop: 4,
    },
    formGroup: {
      gap: spacing.sm,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    optionChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
    },
    optionChipActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.08)'
        : 'rgba(4, 151, 191, 0.08)',
    },
    optionChipLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    optionChipLabelActive: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontWeight: '800',
    },
    editActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: 8,
    },
    saveButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    manageEmployeesButton: {
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageEmployeesButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    errorText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    logoUploadSection: {
      marginTop: spacing.xs,
      gap: spacing.sm,
    },
    logoSectionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    logoRowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    logoPreviewWrapper: {
      position: 'relative',
    },
    logoImagePreview: {
      width: 68,
      height: 68,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
      resizeMode: 'contain',
    },
    deleteLogoBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: isDark ? '#ff5c5c' : colors.danger,
      borderRadius: 12,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 3,
    },
    logoEmptyPlaceholder: {
      width: 68,
      height: 68,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)',
      gap: 2,
    },
    logoEmptyText: {
      fontSize: 9,
      color: colors.textMuted,
      fontWeight: '700',
    },
    logoUploadInfo: {
      flex: 1,
      gap: 2,
    },
    logoUploadHeading: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    logoUploadDesc: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    changeLogoLink: {
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    changeLogoLinkText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
  });
