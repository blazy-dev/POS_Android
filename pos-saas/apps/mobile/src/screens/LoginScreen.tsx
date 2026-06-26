import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useAuth } from "../context/AuthContext";
import { radius, spacing, ThemeColors } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";

export function LoginScreen() {
  const db = useSQLiteContext();
  const { login, loginWithGoogle, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Maneja las pulsaciones de teclas del teclado numérico
  const handlePressKey = async (digit: string) => {
    if (loading) return;
    setErrorMsg(null);

    const nextPin = pin + digit;
    if (nextPin.length <= 4) {
      setPin(nextPin);
    }

    // Al ingresar los 4 dígitos, valida automáticamente contra la DB
    if (nextPin.length === 4) {
      const success = await login(db, nextPin);
      if (!success) {
        // Efecto visual: limpia el PIN y muestra error
        setTimeout(() => {
          setPin("");
          setErrorMsg("PIN incorrecto. Reintentá.");
        }, 300);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setErrorMsg(null);
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setErrorMsg(null);
    setPin("");
  };

  // Renderiza los círculos indicadores de longitud del PIN
  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < 4; i++) {
      const active = i < pin.length;
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            active ? styles.dotActive : null,
            errorMsg ? styles.dotError : null,
          ]}
        />
      );
    }
    return dots;
  };

  // Renderiza una tecla del teclado
  const renderKeyButton = (value: string, label?: string) => {
    return (
      <Pressable
        key={value}
        style={({ pressed }) => [
          styles.keyButton,
          pressed ? styles.keyButtonPressed : null,
        ]}
        onPress={() => handlePressKey(value)}
      >
        <Text style={styles.keyButtonText}>{label ?? value}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Fondo estético difuminado */}
      <View style={styles.backgroundGlow} />

      <View style={styles.container}>
        {/* Cabecera / Marca */}
        <View style={styles.header}>
          <Text style={styles.kicker}>POS SaaS Android-First</Text>
          <Text style={styles.title}>Iniciar Sesión</Text>
          <Text style={styles.subtitle}>Ingresá tu PIN personal de 4 dígitos</Text>
        </View>

        {/* Indicadores de PIN */}
        <View style={styles.pinContainer}>
          <View style={styles.dotsRow}>{renderPinDots()}</View>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
          ) : errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : (
            <Text style={styles.hintText}>PIN demo admin: 1234 · cajero: 4321</Text>
          )}
        </View>

        {/* Teclado Numérico */}
        <View style={styles.keypad}>
          <View style={styles.keypadRow}>
            {renderKeyButton("1")}
            {renderKeyButton("2")}
            {renderKeyButton("3")}
          </View>
          <View style={styles.keypadRow}>
            {renderKeyButton("4")}
            {renderKeyButton("5")}
            {renderKeyButton("6")}
          </View>
          <View style={styles.keypadRow}>
            {renderKeyButton("7")}
            {renderKeyButton("8")}
            {renderKeyButton("9")}
          </View>
          <View style={styles.keypadRow}>
            <Pressable
              style={({ pressed }) => [
                styles.keyButton,
                styles.keyUtilityButton,
                pressed ? styles.keyButtonPressed : null,
              ]}
              onPress={handleClear}
            >
              <Text style={styles.keyUtilityText}>C</Text>
            </Pressable>

            {renderKeyButton("0")}

            <Pressable
              style={({ pressed }) => [
                styles.keyButton,
                styles.keyUtilityButton,
                pressed ? styles.keyButtonPressed : null,
              ]}
              onPress={handleBackspace}
            >
              <Text style={styles.keyUtilityText}>⌫</Text>
            </Pressable>
          </View>
        </View>

        {/* Separador y Google Login */}
        <View style={styles.adminSection}>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>Acceso Propietario</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed ? styles.googleButtonPressed : null,
            ]}
            onPress={async () => {
              const success = await loginWithGoogle(db);
              if (!success) {
                setErrorMsg("Error al iniciar sesión con Google.");
              }
            }}
            disabled={loading}
          >
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>
              {loading ? "Cargando..." : "Ingresar con Google"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundGlow: {
    position: "absolute",
    top: -100,
    alignSelf: "center",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.08)" : "rgba(4, 151, 191, 0.05)",
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.xl,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginTop: 20,
    gap: 8,
  },
  kicker: {
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  pinContainer: {
    alignItems: "center",
    gap: 16,
    marginVertical: 20,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
    backgroundColor: "transparent",
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    backgroundColor: isDark ? "#FFB4B4" : "#D32F2F",
    borderColor: isDark ? "#FFB4B4" : "#D32F2F",
  },
  spinner: {
    height: 18,
  },
  errorText: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
    fontSize: 13,
    fontWeight: "700",
  },
  hintText: {
    color: isDark ? "rgba(175, 191, 206, 0.4)" : "rgba(104, 124, 148, 0.6)",
    fontSize: 11,
    fontStyle: "italic",
  },
  keypad: {
    gap: spacing.md,
    maxWidth: 280,
    alignSelf: "center",
    width: "100%",
  },
  keypadRow: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  keyButton: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.03,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    }),
  },
  keyButtonPressed: {
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.12)" : "rgba(4, 151, 191, 0.12)",
    borderColor: isDark ? "rgba(138, 199, 255, 0.25)" : "rgba(4, 151, 191, 0.25)",
  },
  keyButtonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  keyUtilityButton: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
  },
  keyUtilityText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "800",
  },
  adminSection: {
    alignItems: "center",
    width: "100%",
    marginTop: spacing.md,
    marginBottom: 10,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 280,
    marginBottom: spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  googleButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: 280,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.02,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    }),
  },
  googleButtonPressed: {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.03)",
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EA4335",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
