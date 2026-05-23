import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { colors, typography, radius } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Welcome">;
};

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header / Logo */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>
            Carga<Text style={styles.logoAccent}>Back</Text>
          </Text>
        </View>
        <Text style={styles.tagline}>Para conductores</Text>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>🚛</Text>
        </View>
        <Text style={styles.heroTitle}>Tu trabajo,{"\n"}en tu bolsillo</Text>
        <Text style={styles.heroSubtitle}>
          Gestioná tus viajes, recibí cargas y controlá todo desde la app.
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { valor: "3.400+", label: "Conductores" },
            { valor: "94%", label: "Retorno" },
            { valor: "12 min", label: "Match" },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValor}>{s.valor}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate("Login")}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Iniciar sesión →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate("RegisterRole")}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>Crear cuenta gratis</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>© 2026 CargaBack · Argentina</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  logoText: {
    fontSize: typography.size.xl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: colors.brandLight,
  },
  tagline: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.semibold,
    backgroundColor: colors.brandAlpha,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: "hidden",
  },

  hero: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    gap: 20,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.brandAlpha,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroSubtitle: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
  },
  statValor: {
    fontSize: typography.size.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.brandLight,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 3,
  },

  actions: {
    paddingHorizontal: 28,
    paddingBottom: 32,
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnPrimaryText: {
    fontSize: typography.size.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.2,
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    fontSize: typography.size.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  footerText: {
    textAlign: "center",
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
});
