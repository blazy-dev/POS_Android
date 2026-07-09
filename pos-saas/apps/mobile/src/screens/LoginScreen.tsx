import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../context/AuthContext';
import { radius, spacing, fontSize, fontWeight, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { getAppMeta } from '../database';

export function LoginScreen() {
  const db = useSQLiteContext();
  const { login, loginWithGoogle, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');

  // Cargar nombre del comercio si existe
  useEffect(() => {
    async function loadTenantName() {
      try {
        const name = await getAppMeta<string>(db, 'tenant_name');
        if (name) setTenantName(name);
      } catch {
        // Ignore
      }
    }
    loadTenantName();
  }, [db]);

  // Maneja las pulsaciones de teclas del teclado numÃ©rico
  const handlePressKey = async (digit: string) => {
    if (loading) return;
    setErrorMsg(null);
    const nextPin = pin + digit;
    if (nextPin.length <= 4) setPin(nextPin);
    if (nextPin.length === 4) {
      const success = await login(db, nextPin);
      if (!success) {
        setTimeout(() => {
          setPin('');
          setErrorMsg('PIN incorrecto. Reintentá.');
        }, 300);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setErrorMsg(null);
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setErrorMsg(null);
    setPin('');
  };

  // Renderiza una tecla numÃ©rica del teclado
  const renderKeyButton = (value: string) => (
    <Pressable
      key={value}
      style={({ pressed }) => [styles.keyButton, pressed && styles.keyButtonPressed]}
      onPress={() => handlePressKey(value)}
    >
      <Text style={styles.keyButtonText}>{value}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[
        styles.container,
        { paddingBottom: Math.max(36, insets.bottom + 24) },
      ]}>

        {/* â”€â”€ Marca â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandName}>Ventu POS</Text>
          {tenantName ? (
            <View style={styles.tenantBadge}>
              <Text style={styles.tenantBadgeText}>{tenantName}</Text>
            </View>
          ) : null}
          <Text style={styles.subtitle}>Ingresa tu PIN para continuar</Text>
        </View>

        {/* â”€â”€ PIN + Teclado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.pinSection}>
          {/* Barras de progreso estilo Shadcn */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinBar,
                  i < pin.length && styles.pinBarActive,
                  !!errorMsg && styles.pinBarError,
                ]}
              />
            ))}
          </View>

          {/* Estado / error / hint */}
          <View style={styles.statusRow}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}
          </View>

          {/* Teclado numÃ©rico */}
          <View style={styles.keypad}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map((d) => renderKeyButton(d))}
              </View>
            ))}
            <View style={styles.keypadRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.keyButton,
                  styles.keyUtility,
                  pressed && styles.keyUtilityPressed,
                ]}
                onPress={handleClear}
              >
                <Text style={styles.keyUtilityText}>C</Text>
              </Pressable>

              {renderKeyButton('0')}

              <Pressable
                style={({ pressed }) => [
                  styles.keyButton,
                  styles.keyUtility,
                  pressed && styles.keyUtilityPressed,
                ]}
                onPress={handleBackspace}
              >
                <Ionicons name="backspace-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* â”€â”€ Acceso con Google â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.authSection}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Acceso Propietario</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              loading && styles.googleButtonDisabled,
            ]}
            onPress={async () => {
              const success = await loginWithGoogle(db);
              if (!success) setErrorMsg('Error al iniciar sesión con Google.');
            }}
            disabled={loading}
          >
            <View style={styles.googleIconBox}>
              <Ionicons name="logo-google" size={15} color="#18181b" />
            </View>
            <Text style={styles.googleButtonText}>
              {loading ? 'Cargando...' : 'Ingresar con Google'}
            </Text>
            <Ionicons
              name="arrow-forward-outline"
              size={14}
              color={isDark ? '#71717a' : '#a1a1aa'}
            />
          </Pressable>
        </View>

      </View>
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
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: 36,
    },

    // â”€â”€ Marca â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    header: {
      alignItems: 'center',
      gap: 8,
      paddingTop: 32,
    },
    logoContainer: {
      width: 100,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    brandName: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    // Tenant como badge pill â€” mÃ¡s Shadcn que texto plano
    tenantBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tenantBadgeText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 2,
    },

    // â”€â”€ PIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    pinSection: {
      alignItems: 'center',
      gap: 20,
    },
    dotsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    // Barras horizontales planas â€” estÃ©tica Shadcn (reemplazan los cÃ­rculos)
    pinBar: {
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    },
    pinBarActive: {
      backgroundColor: colors.text,
    },
    pinBarError: {
      backgroundColor: colors.danger,
    },
    statusRow: {
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 11,
      fontStyle: 'italic',
      opacity: 0.65,
    },

    // â”€â”€ Teclado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    keypad: {
      gap: spacing.sm,
      width: 264,
      alignSelf: 'center',
    },
    keypadRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    keyButton: {
      flex: 1,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyButtonPressed: {
      backgroundColor: isDark ? '#27272a' : '#e4e4e7',
      borderColor: isDark ? '#3f3f46' : '#d4d4d8',
    },
    keyButtonText: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '600',
    },
    // Botones de utilidad (C y borrar): ghost, sin fondo
    keyUtility: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    keyUtilityPressed: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    keyUtilityText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '700',
    },

    // â”€â”€ Google â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    authSection: {
      gap: spacing.sm,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    // Estilo primario Shadcn: fondo sÃ³lido oscuro en light mode, surface en dark
    googleButton: {
      height: 48,
      borderRadius: radius.md,
      backgroundColor: isDark ? colors.surface : '#18181b',
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#18181b',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 10,
    },
    googleButtonPressed: {
      backgroundColor: '#27272a',
      borderColor: '#27272a',
    },
    googleButtonDisabled: {
      opacity: 0.5,
    },
    googleButtonText: {
      color: isDark ? colors.text : '#fafafa',
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    // Icono Google siempre en caja blanca para contrastar con cualquier fondo
    googleIconBox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
