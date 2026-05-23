import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { colors, typography, radius } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RegisterRole">;
};

const ROLES = [
  {
    id: "transportista" as const,
    emoji: "🚛",
    titulo: "Transportista individual",
    descripcion: "Ofertá cargas, gestioná tus viajes y camiones.",
    badge: "Sin código de invitación",
    badgeColor: colors.brand,
  },
  {
    id: "empleado" as const,
    emoji: "👷",
    titulo: "Empleado de flota",
    descripcion: "Recibí viajes asignados por el dueño de tu flota.",
    badge: "Requiere código de invitación",
    badgeColor: "rgba(255,255,255,0.4)",
  },
];

export function RegisterRoleScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        {/* Logo */}
        <Text style={styles.logo}>
          Carga<Text style={styles.logoAccent}>Back</Text>
        </Text>

        {/* Title */}
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>¿Cuál es tu rol?</Text>

        {/* Role cards */}
        <View style={styles.cards}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("RegisterForm", { role: role.id })
              }
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View style={styles.emojiContainer}>
                  <Text style={styles.emoji}>{role.emoji}</Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{role.titulo}</Text>
                  <Text style={styles.cardDesc}>{role.descripcion}</Text>
                  <View style={[styles.badgePill, { borderColor: role.badgeColor }]}>
                    <Text style={[styles.badgeText, { color: role.badgeColor }]}>
                      {role.badge}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.dividerLine} />

        {/* Login link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>¿Ya tenés cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.7}>
            <Text style={styles.loginLink}>Iniciá sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 32,
  },
  backText: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.semibold,
  },
  logo: {
    fontSize: typography.size.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  logoAccent: {
    color: colors.brandLight,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    marginBottom: 28,
  },
  cards: {
    gap: 14,
    marginBottom: 32,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brandAlpha,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 24,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  badgePill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  arrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  dividerLine: {
    height: 0.5,
    backgroundColor: colors.border,
    marginBottom: 24,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.fontWeight.bold,
  },
});
