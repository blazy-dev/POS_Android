import { forwardRef, ReactNode, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { radius, spacing, fontSize, fontWeight, ThemeColors } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

type FormFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  accessory?: ReactNode;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(
  function FormField(
    { label, required = false, error, hint, accessory, style, onFocus, onBlur, ...inputProps },
    ref,
  ) {
    const { colors, isDark } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

    return (
      <View style={styles.wrapper}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required ? ' *' : ''}
          </Text>
          {accessory}
        </View>

        <TextInput
          ref={ref}
          placeholderTextColor={isDark ? '#708090' : '#98A8B8'}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            isFocused ? styles.inputFocused : null,
            error ? styles.inputError : null,
            style,
          ]}
          {...inputProps}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  },
);

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    input: {
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    inputFocused: {
      borderColor: isDark ? '#fafafa' : '#18181b',
    },
    inputError: {
      borderColor: colors.danger,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    error: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 12,
      lineHeight: 17,
    },
  });
