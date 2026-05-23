import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getMyTrips, Viaje } from "../../api";
import { colors, typography, radius } from "../../theme";
import { ViajesStackParamList } from "./MainNavigator";

type Props = {
  navigation: NativeStackNavigationProp<ViajesStackParamList, "ViajesList">;
};

const STATUS_LABEL: Record<string, string> = {
  in_transit: "En tránsito",
  matched: "Confirmado",
  delivered: "Entregado",
};
const STATUS_COLOR: Record<string, string> = {
  in_transit: colors.brand,
  matched: "#3b82f6",
  delivered: colors.textMuted,
};

function TripCard({
  viaje,
  large,
  onPress,
}: {
  viaje: Viaje;
  large?: boolean;
  onPress: () => void;
}) {
  const statusColor = STATUS_COLOR[viaje.status] ?? colors.textMuted;
  const statusLabel = STATUS_LABEL[viaje.status] ?? viaje.status;

  return (
    <TouchableOpacity
      style={[styles.card, large && styles.cardLarge]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.routeRow}>
        <Text style={styles.city} numberOfLines={1}>{viaje.pickupCity}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.city} numberOfLines={1}>{viaje.dropoffCity}</Text>
      </View>
      <Text style={styles.cargo} numberOfLines={1}>{viaje.titulo}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.empresa} numberOfLines={1}>{viaje.empresa}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.fecha}>{viaje.fechaRetiro}</Text>
      </View>
      <View style={styles.bottomRow}>
        <View style={[styles.badge, { borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.price}>
          ${Math.round(viaje.precio).toLocaleString("es-AR")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

type Section =
  | { key: string; type: "header"; title: string }
  | { key: string; type: "empty"; text: string }
  | { key: string; type: "spacer" }
  | { key: string; type: "viaje"; viaje: Viaje; large?: boolean };

export function ViajesScreen({ navigation }: Props) {
  const [enCurso, setEnCurso] = useState<Viaje[]>([]);
  const [proximos, setProximos] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getMyTrips();
      setEnCurso(data.enCurso);
      setProximos(data.proximos);
      setError("");
    } catch {
      setError("No se pudieron cargar los viajes.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections: Section[] = [
    { key: "header-en-curso", type: "header", title: "En curso" },
    ...(enCurso.length === 0
      ? [{ key: "empty-en-curso", type: "empty" as const, text: "No tenés viajes en curso" }]
      : enCurso.map((v) => ({ key: v.offerId, type: "viaje" as const, viaje: v, large: true }))),
    { key: "spacer", type: "spacer" },
    { key: "header-proximos", type: "header", title: "Próximos" },
    ...(proximos.length === 0
      ? [{ key: "empty-proximos", type: "empty" as const, text: "No tenés próximos viajes" }]
      : proximos.map((v) => ({ key: v.offerId, type: "viaje" as const, viaje: v }))),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Viajes</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => {
            if (item.type === "header")
              return <Text style={styles.sectionTitle}>{item.title}</Text>;
            if (item.type === "empty")
              return (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{item.text}</Text>
                </View>
              );
            if (item.type === "spacer") return <View style={{ height: 8 }} />;
            return (
              <TripCard
                viaje={item.viaje}
                large={item.large}
                onPress={() => navigation.navigate("ViajeDetalle", { viaje: item.viaje })}
              />
            );
          }}
        />
      )}
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
  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  cardLarge: { padding: 18, borderColor: colors.brand, backgroundColor: colors.brandAlpha },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  city: { flex: 1, fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.white },
  arrow: { fontSize: typography.size.base, color: colors.textMuted },
  cargo: { fontSize: typography.size.sm, color: colors.textSecondary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  empresa: { fontSize: typography.size.sm, color: colors.textMuted, flexShrink: 1 },
  dot: { fontSize: typography.size.sm, color: colors.textMuted },
  fecha: { fontSize: typography.size.sm, color: colors.textMuted },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.fontWeight.semibold },
  price: { fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.brandLight },
  emptyBox: { paddingVertical: 20, alignItems: "center", marginBottom: 10 },
  emptyText: { fontSize: typography.size.sm, color: colors.textMuted },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: typography.size.sm, color: colors.textMuted },
});
