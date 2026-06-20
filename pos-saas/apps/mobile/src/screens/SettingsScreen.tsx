import { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { radius, spacing, ThemeColors } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { theme, colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Ajustes</Text>
        <Text style={styles.title}>Configuración del comercio y del dispositivo</Text>
        <Text style={styles.subtitle}>
          Aquí se conectarán tenant, usuario, dispositivo, hardware y preferencias de la app.
        </Text>

        {user ? (
          <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>Usuario Activo</Text>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileRole}>
                Rol: {user.role === "admin" ? "Administrador" : "Cajero"}
              </Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutButtonText}>Cerrar Sesión (Salir)</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apariencia</Text>
          <Text style={styles.cardText}>Elegí el tema visual de la aplicación:</Text>
          
          <View style={styles.themeSelectorRow}>
            <Pressable
              style={[
                styles.themeButton,
                theme === "light" && styles.themeButtonActive,
              ]}
              onPress={() => {
                void toggleTheme();
              }}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  theme === "light" && styles.themeButtonTextActive,
                ]}
              >
                ☀️ Claro
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.themeButton,
                theme === "dark" && styles.themeButtonActive,
              ]}
              onPress={() => {
                void toggleTheme();
              }}
            >
              <Text
                style={[
                  styles.themeButtonText,
                  theme === "dark" && styles.themeButtonTextActive,
                ]}
              >
                🌙 Oscuro
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Próximos bloques</Text>
          <Text style={styles.cardText}>Perfil del comercio</Text>
          <Text style={styles.cardText}>Dispositivos</Text>
          <Text style={styles.cardText}>Impresora y lector</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  kicker: {
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    marginTop: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    }),
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  profileCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    }),
  },
  profileInfo: {
    gap: 4,
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  profileRole: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  profileEmail: {
    color: colors.textMuted,
    fontSize: 13,
  },
  logoutButton: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(255, 180, 180, 0.08)" : "rgba(211, 47, 47, 0.08)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255, 180, 180, 0.18)" : "rgba(211, 47, 47, 0.18)",
    alignItems: "center",
  },
  logoutButtonText: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
    fontSize: 13,
    fontWeight: "800",
  },
  themeSelectorRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: 8,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  themeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.16)" : "rgba(4, 151, 191, 0.12)",
  },
  themeButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  themeButtonTextActive: {
    color: isDark ? "#FFFFFF" : colors.primary,
    fontWeight: "800",
  },
});