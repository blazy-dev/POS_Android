import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PRODUCT_UNITS } from '../../utils/productValidation';
import { radius, spacing, ThemeColors } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

type UnitPickerProps = {
  value: string;
  onChange: (unit: string) => void;
};

export function UnitPicker({ value, onChange }: UnitPickerProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Unidad de medida</Text>
      <View style={styles.grid}>
        {PRODUCT_UNITS.map((unit) => {
          const active = unit.value === value;

          return (
            <Pressable
              key={unit.value}
              onPress={() => onChange(unit.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {unit.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surface,
    },
    chipActive: {
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.18)'
        : 'rgba(4, 151, 191, 0.15)',
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    chipTextActive: {
      color: isDark ? '#EAF4FF' : colors.primary,
    },
  });
