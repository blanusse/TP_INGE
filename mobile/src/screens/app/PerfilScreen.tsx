import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { getUser, clearAuth } from "../../api";
import { colors, typography, radius } from "../../theme";

type Props = {
  onLogout: () => void;
};

const ROLE_LABEL: Record<string, string> = {
  transportista: "Transportista",
  shipper: "Dador de carga",
  admin: "Administrador",
  empleado: "Empleado de flota",
};

export function PerfilScreen({ onLogout }: Props) {
  const user = getUser();
  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <Text style={styles.name}>{user?.name ?? "-"}</Text>
        <Text style={styles.email}>{user?.email ?? "-"}</Text>

        {user?.role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{ROLE_LABEL[user.role] ?? user.role}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.fontWeight.bold, color: colors.white },
  content: { flex: 1, alignItems: "center", paddingTop: 48, paddingHorizontal: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandAlpha,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.brandLight },
  name: { fontSize: typography.size.xl, fontWeight: typography.fontWeight.bold, color: colors.white, marginBottom: 4, textAlign: "center" },
  email: { fontSize: typography.size.base, color: colors.textSecondary, marginBottom: 12, textAlign: "center" },
  roleBadge: {
    backgroundColor: colors.brandAlpha,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: { fontSize: typography.size.sm, color: colors.brandLight, fontWeight: typography.fontWeight.semibold },
  divider: { width: "100%", height: 0.5, backgroundColor: colors.border, marginVertical: 40 },
  logoutBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#ef4444",
    alignItems: "center",
  },
  logoutText: { fontSize: typography.size.base, fontWeight: typography.fontWeight.semibold, color: "#ef4444" },
});
