import { useMemo } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import { fontSize, fontWeight, spacing, radius } from '../theme/tokens';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  animatedStyle?: any;
}

export function MetricCard({ label, value, icon, animatedStyle }: MetricCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const cardContent = (
    <View style={styles.contentWrapper}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && (
          <Ionicons name={icon} size={16} color={colors.textMuted} />
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      {animatedStyle ? (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          {cardContent}
        </Animated.View>
      ) : (
        cardContent
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden', // Para ocultar el contenido que hace slide fuera de la tarjeta
    },
    contentWrapper: {
      flex: 1,
      padding: spacing.lg,
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
