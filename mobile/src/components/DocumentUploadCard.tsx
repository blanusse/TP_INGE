import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { colors, typography, radius } from "../theme";

type Props = {
  label: string;
  verified: boolean;
  onUpload: () => void;
  loading: boolean;
  vencimiento?: string;
  disabled?: boolean;
  disabledMessage?: string;
};

export function DocumentUploadCard({ label, verified, onUpload, loading, vencimiento, disabled, disabledMessage }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgePending]}>
          <Text style={[styles.badgeText, verified ? styles.badgeTextVerified : styles.badgeTextPending]}>
            {verified ? "Verificado" : "Pendiente"}
          </Text>
        </View>
      </View>

      {verified && vencimiento && (
        <Text style={styles.vencimiento}>Vence: {vencimiento}</Text>
      )}

      {disabled && disabledMessage ? (
        <Text style={styles.disabledText}>{disabledMessage}</Text>
      ) : loading ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : !verified ? (
        <TouchableOpacity style={styles.button} onPress={onUpload} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Subir foto</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeVerified: {
    backgroundColor: "rgba(22,163,74,0.15)",
  },
  badgePending: {
    backgroundColor: "rgba(234,179,8,0.15)",
  },
  badgeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  badgeTextVerified: {
    color: colors.success,
  },
  badgeTextPending: {
    color: "#eab308",
  },
  vencimiento: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 6,
  },
  button: {
    marginTop: 12,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.semibold,
  },
  spinner: {
    marginTop: 12,
  },
  disabledText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    marginTop: 8,
    fontStyle: "italic",
  },
});
