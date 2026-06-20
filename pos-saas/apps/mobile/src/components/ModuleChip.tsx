import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/tokens";

export function ModuleChip({ label }: { label: string }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.10)" : "rgba(4, 151, 191, 0.08)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(138, 199, 255, 0.16)" : "rgba(4, 151, 191, 0.16)",
  },
  label: {
    color: isDark ? "#DDEEFF" : colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});