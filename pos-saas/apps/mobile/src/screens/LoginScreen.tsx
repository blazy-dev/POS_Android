import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

  // Maneja las pulsaciones de teclas del teclado numérico
  const handlePressKey = async (digit: string) => {
    if (loading) return;
    setErrorMsg(null);

    const nextPin = pin + digit;
    if (nextPin.length <= 4) {
      setPin(nextPin);
    }

    // Al ingresar los 4 dígitos, valida automáticamente contra la DB
    if (nextPin.length === 4) {
      const success = await login(db, nextPin);
      if (!success) {
        // Efecto visual: limpia el PIN y muestra error
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

  // Renderiza los círculos indicadores de longitud del PIN
  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      const active = i < pin.length;
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            active ? styles.dotActive : null,
            errorMsg ? styles.dotError : null,
          ]}
        />,
      );
    }
    return dots;
  };

  // Renderiza una tecla del teclado
  const renderKeyButton = (value: string) => {
    return (
      <Pressable
        key={value}
        style={({ pressed }) => [
          styles.keyButton,
          pressed ? styles.keyButtonPressed : null,
        ]}
        onPress={() => handlePressKey(value)}
      >
        <Text style={styles.keyButtonText}>{value}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Cabecera con ícono de marca */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons
              name="storefront-outline"
              size={32}
              color={colors.text}
            />
          </View>
          <Text style={styles.brandName}>POS SaaS</Text>
          {tenantName ? (
            <Text style={styles.tenantName}>{tenantName}</Text>
          ) : null}
          <Text style={styles.subtitle}>
            Ingresá tu PIN de 4 dígitos
          </Text>
        </View>

        {/* Indicadores de PIN */}
        <View style={styles.pinContainer}>
          <View style={styles.dotsRow}>{renderPinDots()}</View>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={colors.text}
              style={styles.spinner}
            />
          ) : errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : (
            <Text style={styles.hintText}>
              PIN demo: admin 1234 · cajero 4321
            </Text>
          )}
        </View>

        {/* Teclado Numérico */}
        <View style={styles.keypad}>
          <View style={styles.keypadRow}>
            {renderKeyButton('1')}
            {renderKeyButton('2')}
            {renderKeyButton('3')}
          </View>
          <View style={styles.keypadRow}>
            {renderKeyButton('4')}
            {renderKeyButton('5')}
            {renderKeyButton('6')}
          </View>
          <View style={styles.keypadRow}>
            {renderKeyButton('7')}
            {renderKeyButton('8')}
            {renderKeyButton('9')}
          </View>
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [
                styles.keyButton,
                styles.keyUtilityButton,
                pressed ? styles.keyUtilityPressed : null,
              ]}
              onPress={handleClear}
            >
              <Text style={styles.keyUtilityText}>C</Text>
            </Pressable>

            {renderKeyButton('0')}

            <Pressable
              style={({ pressed }) => [
                styles.keyButton,
                styles.keyUtilityButton,
                pressed ? styles.keyUtilityPressed : null,
              ]}
              onPress={handleBackspace}
            >
              <Ionicons name="backspace-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Separador y Google Login */}
        <View style={styles.adminSection}>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>Acceso Propietario</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed ? styles.googleButtonPressed : null,
            ]}
            onPress={async () => {
              const success = await loginWithGoogle(db);
              if (!success) {
                setErrorMsg('Error al iniciar sesión con Google.');
              }
            }}
            disabled={loading}
          >
            <View style={styles.googleIconContainer}>
              <Ionicons name="logo-google" size={16} color="#18181b" />
            </View>
            <Text style={styles.googleButtonText}>
              {loading ? 'Cargando...' : 'Ingresar con Google'}
            </Text>
            <Ionicons name="arrow-forward-outline" size={14} color={colors.textMuted} />
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
      padding: spacing.xl,
      paddingVertical: 32,
    },
    header: {
      alignItems: 'center',
      marginTop: 16,
      gap: 6,
    },
    logoContainer: {
      width: 60,
      height: 60,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    brandName: {
      color: colors.text,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.bold,
    },
    tenantName: {
      color: colors.text,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.base,
      textAlign: 'center',
      marginTop: 4,
    },
    pinContainer: {
      alignItems: 'center',
      gap: 16,
      marginVertical: 16,
    },
    dotsRow: {
      flexDirection: 'row',
      gap: 20,
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    dotActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    dotError: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    spinner: {
      height: 18,
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontStyle: 'italic',
      opacity: 0.6,
    },
    keypad: {
      gap: spacing.sm,
      maxWidth: 260,
      alignSelf: 'center',
      width: '100%',
    },
    keypadRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    keyButton: {
      flex: 1,
      height: 52,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyButtonPressed: {
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
    },
    keyButtonText: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
    },
    keyUtilityButton: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    keyUtilityPressed: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    },
    keyUtilityText: {
      color: colors.textMuted,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
    },
    adminSection: {
      alignItems: 'center',
      width: '100%',
      marginTop: spacing.sm,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: 260,
      marginBottom: spacing.sm,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    googleButton: {
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      width: 260,
    },
    googleButtonPressed: {
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
    },
    googleButtonText: {
      color: colors.text,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      flex: 1,
    },
    googleIconContainer: {
      width: 24,
      height: 24,
      borderRadius: radius.sm - 2,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleG: {
      fontSize: 16,
      fontWeight: '800' as const,
      color: '#4285F4',
    },
  });
