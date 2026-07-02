import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../context/AuthContext';
import { FormField } from '../components/form/FormField';
import { radius, spacing, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

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

export function OnboardingScreen() {
  const db = useSQLiteContext();
  const { completeOnboarding, cancelOnboarding, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [businessName, setBusinessName] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);
    const trimmedName = businessName.trim();

    if (!trimmedName) {
      setErrorMsg('El nombre comercial es obligatorio.');
      return;
    }

    const success = await completeOnboarding(
      db,
      trimmedName,
      currency,
      timezone,
    );
    if (!success) {
      setErrorMsg(
        'Error al registrar el comercio en el servidor. Intentá de nuevo.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundGlow} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Paso Final de Registro</Text>
          <Text style={styles.title}>Configurar tu Comercio</Text>
          <Text style={styles.subtitle}>
            Rellená los datos básicos para inicializar tu plataforma POS.
          </Text>
        </View>

        <View style={styles.card}>
          <FormField
            label="Nombre del negocio / Comercio"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Mi Almacén POS"
            required
            autoFocus
            error={errorMsg && !businessName.trim() ? errorMsg : undefined}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moneda de facturación *</Text>
            <View style={styles.optionsGrid}>
              {CURRENCIES.map((c) => {
                const active = currency === c.value;
                return (
                  <Pressable
                    key={c.value}
                    style={[
                      styles.optionCard,
                      active && styles.optionCardActive,
                    ]}
                    onPress={() => setCurrency(c.value)}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        active && styles.optionLabelActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                    <Text style={styles.optionDesc}>{c.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zona horaria local *</Text>
            <View style={styles.optionsList}>
              {TIMEZONES.map((t) => {
                const active = timezone === t.value;
                return (
                  <Pressable
                    key={t.value}
                    style={[styles.listRow, active && styles.listRowActive]}
                    onPress={() => setTimezone(t.value)}
                  >
                    <View style={styles.rowInfo}>
                      <Text
                        style={[
                          styles.rowLabel,
                          active && styles.rowLabelActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                      <Text style={styles.rowDesc}>{t.value}</Text>
                    </View>
                    <Text style={styles.rowGmt}>{t.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {errorMsg && businessName.trim() ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
                loading ? styles.buttonDisabled : null,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Comenzar a operar</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
                loading ? styles.buttonDisabled : null,
              ]}
              onPress={cancelOnboarding}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Cancelar registro</Text>
            </Pressable>
          </View>
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
    backgroundGlow: {
      position: 'absolute',
      top: -120,
      right: -100,
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.06)'
        : 'rgba(4, 151, 191, 0.04)',
    },
    scrollContainer: {
      padding: spacing.xl,
      gap: spacing.lg,
      paddingBottom: 40,
    },
    header: {
      marginTop: 10,
      gap: 6,
    },
    kicker: {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      fontSize: 12,
      fontWeight: '700',
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
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 20,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }),
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionCard: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
    },
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.06)'
        : 'rgba(4, 151, 191, 0.06)',
    },
    optionLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    optionLabelActive: {
      color: isDark ? '#8AC7FF' : colors.primary,
    },
    optionDesc: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    optionsList: {
      gap: 6,
    },
    listRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
    },
    listRowActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.06)'
        : 'rgba(4, 151, 191, 0.06)',
    },
    rowInfo: {
      gap: 2,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    rowLabelActive: {
      color: isDark ? '#8AC7FF' : colors.primary,
    },
    rowDesc: {
      color: colors.textMuted,
      fontSize: 10,
    },
    rowGmt: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    errorText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
    },
    actions: {
      gap: spacing.sm,
      marginTop: 10,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonPressed: {
      opacity: 0.85,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButton: {
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonPressed: {
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.02)',
    },
    secondaryButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.65,
    },
  });
