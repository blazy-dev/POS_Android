import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/tokens';
import { fontSize, fontWeight, radius } from '../../theme/tokens';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

/**
 * Badge ultra-minimalista estilo Shadcn UI.
 */
export function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const variantStyle = getVariantStyle(colors, variant);

  return (
    <View
      style={[
        styles.badge,
        size === 'md' && styles.badgeMd,
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          size === 'md' && styles.labelMd,
          { color: variantStyle.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function getVariantStyle(colors: ThemeColors, variant: BadgeVariant) {
  switch (variant) {
    case 'success':
      return { bg: colors.successSoft, border: colors.successBorder, text: colors.success };
    case 'warning':
      return { bg: colors.warningSoft, border: colors.warningBorder, text: colors.warning };
    case 'danger':
      return { bg: colors.dangerSoft, border: colors.dangerBorder, text: colors.danger };
    case 'info':
      return { bg: colors.infoSoft, border: colors.infoBorder, text: colors.info };
    case 'neutral':
      return {
        bg: colors.primarySoft,
        border: colors.border,
        text: colors.textMuted,
      };
  }
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm, // Formato angular sutil
      borderWidth: 1,
    },
    badgeMd: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    label: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    labelMd: {
      fontSize: fontSize.sm,
    },
  });
