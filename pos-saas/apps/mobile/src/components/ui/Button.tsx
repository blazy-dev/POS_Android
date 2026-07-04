import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/tokens';
import { radius, fontSize, fontWeight, iconSize } from '../../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/**
 * Botón premium con la estética plana y sólida de Shadcn UI.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
  style,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const isDisabled = disabled || loading;

  const variantStyles = getVariantStyles(colors, isDark, variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles.container,
        sizeStyles,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && variantStyles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.textColor} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Ionicons
              name={icon}
              size={size === 'sm' ? iconSize.sm : iconSize.md}
              color={variantStyles.textColor}
            />
          )}
          <Text
            style={[
              styles.label,
              { color: variantStyles.textColor },
              size === 'sm' && styles.labelSm,
              size === 'lg' && styles.labelLg,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function getVariantStyles(colors: ThemeColors, isDark: boolean, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      // Brand Primary: Celeste/cyan sólido de la app con texto blanco de alto impacto
      return {
        container: {
          backgroundColor: colors.primary,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        pressed: {
          backgroundColor: isDark ? 'rgba(4, 151, 191, 0.8)' : 'rgba(4, 151, 191, 0.85)',
          borderColor: colors.primary,
        },
        textColor: '#ffffff',
      };
    case 'secondary':
      // Shadcn Secondary: Fondo gris apagado/zinc
      return {
        container: {
          backgroundColor: isDark ? '#27272a' : '#f4f4f5',
          borderWidth: 0,
          borderColor: 'transparent',
        },
        pressed: {
          backgroundColor: isDark ? '#3f3f46' : '#e4e4e7',
        },
        textColor: isDark ? '#fafafa' : '#18181b',
      };
    case 'outline':
      // Shadcn Outline: Borde fino, fondo transparente
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed: {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
        },
        textColor: colors.text,
      };
    case 'danger':
      // Shadcn Destructive: Sólido rojo
      return {
        container: {
          backgroundColor: isDark ? '#7f1d1d' : '#ef4444',
          borderWidth: 0,
          borderColor: 'transparent',
        },
        pressed: {
          backgroundColor: isDark ? '#991b1b' : '#dc2626',
        },
        textColor: '#ffffff',
      };
    case 'ghost':
      // Shadcn Ghost: Totalmente plano
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
        },
        pressed: {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
        },
        textColor: colors.textMuted,
      };
  }
}

function getSizeStyles(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm };
    case 'md':
      return { paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.sm };
    case 'lg':
      return { paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.md };
  }
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullWidth: {
      width: '100%',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    label: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.bold,
    },
    labelSm: {
      fontSize: fontSize.sm,
    },
    labelLg: {
      fontSize: fontSize.lg,
    },
    disabled: {
      opacity: 0.4,
    },
  });
