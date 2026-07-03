import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import { radius, fontSize, fontWeight, spacing } from '../theme/tokens';

interface ActionCardProps {
  label: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function ActionCard({
  label,
  description,
  icon = 'arrow-forward-circle-outline',
  onPress,
}: ActionCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={20}
          color={colors.text}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.sm, // Angular Shadcn
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    cardPressed: {
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: radius.sm - 2,
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
      gap: 2,
    },
    label: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
    },
    description: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      lineHeight: 18,
    },
  });
