import { forwardRef, ReactNode, useMemo } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { radius, spacing, ThemeColors } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

type FormFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  accessory?: ReactNode;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, required = false, error, hint, accessory, style, ...inputProps },
  ref
) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required ? " *" : ""}
        </Text>
        {accessory}
      </View>

      <TextInput
        ref={ref}
        placeholderTextColor={isDark ? "#708090" : "#98A8B8"}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputError: {
    borderColor: isDark ? "rgba(255, 120, 120, 0.55)" : "rgba(231, 76, 60, 0.55)",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
    fontSize: 12,
    lineHeight: 17,
  },
});

