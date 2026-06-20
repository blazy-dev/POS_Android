import { PropsWithChildren, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/tokens";

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  content: {
    gap: 12,
  },
});