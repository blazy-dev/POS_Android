import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/tokens';

export function ActionCard({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    label: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
