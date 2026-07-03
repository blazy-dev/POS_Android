import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/tokens';
import { fontSize, fontWeight, spacing } from '../../theme/tokens';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

/**
 * Componente de estado vacío con ícono grande, título y subtítulo.
 * Reemplaza textos planos como "Carrito vacío" o "Sin productos".
 */
export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={icon}
          size={36}
          color={isDark ? 'rgba(138, 199, 255, 0.5)' : 'rgba(4, 151, 191, 0.4)'}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing['3xl'],
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.06)'
        : 'rgba(4, 151, 191, 0.05)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.12)'
        : 'rgba(4, 151, 191, 0.10)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.extrabold,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      lineHeight: 19,
      textAlign: 'center',
      maxWidth: 260,
    },
  });
