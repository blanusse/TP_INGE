import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
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

export function DocumentUploadCard({
  label,
  verified,
  onUpload,
  loading,
  vencimiento,
  disabled,
  disabledMessage,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: verified ? colors.brand : "rgba(234,179,8,0.2)" },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: verified ? "#fff" : "#eab308" },
            ]}
          >
            {verified ? "Verificado" : "Pendiente"}
          </Text>
        </View>
      </View>

      {vencimiento && verified && (
        <Text style={styles.vencimiento}>Vence: {vencimiento}</Text>
      )}

      {disabled && disabledMessage ? (
        <Text style={styles.disabledText}>{disabledMessage}</Text>
      ) : loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 10 }} />
      ) : !verified ? (
        <TouchableOpacity style={styles.button} onPress={onUpload}>
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
    fontSize: typography.size.md,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  vencimiento: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 6,
  },
  button: {
    marginTop: 10,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.size.base,
  },
  disabledText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    marginTop: 8,
    fontStyle: "italic",
  },
});
