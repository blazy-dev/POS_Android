import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/tokens";

export function MetricCard({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 88,
    justifyContent: "space-between",
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
});