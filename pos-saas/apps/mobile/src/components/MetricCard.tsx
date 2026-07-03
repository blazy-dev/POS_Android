import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import { fontSize, fontWeight, spacing, radius } from '../theme/tokens';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function MetricCard({ label, value, icon }: MetricCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && (
          <Ionicons name={icon} size={16} color={colors.textMuted} />
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    value: {
      color: colors.text,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.bold,
    },
    label: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
