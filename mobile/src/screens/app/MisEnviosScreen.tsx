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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getMyLoads, MiCarga } from "../../api";
import { colors, typography, radius } from "../../theme";
import { MisEnviosStackParamList } from "./MainNavigator";

type Props = NativeStackScreenProps<MisEnviosStackParamList, "MisEnviosList">;

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function EnvioCard({ carga, active, onPress }: { carga: MiCarga; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.card, active && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.routeRow}>
        <Text style={styles.city} numberOfLines={1}>{carga.pickup_city}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.city} numberOfLines={1}>{carga.dropoff_city}</Text>
      </View>

      {carga.cargo_type && (
        <Text style={styles.cargoType}>{carga.cargo_type}</Text>
      )}

      {carga.accepted_offer && (
        <Text style={styles.driver}>
          Transportista: {carga.accepted_offer.driverName}
        </Text>
      )}

      <View style={styles.bottomRow}>
        <View style={[styles.badge, active ? styles.badgeActive : styles.badgeDone]}>
          <Text style={[styles.badgeText, active ? styles.badgeTextActive : styles.badgeTextDone]}>
            {active ? "En tránsito" : "Entregado"}
          </Text>
        </View>
        <View style={styles.priceCol}>
          {carga.accepted_offer?.precio != null && (
            <Text style={styles.price}>
              ${Math.round(carga.accepted_offer.precio).toLocaleString("es-AR")}
            </Text>
          )}
          {carga.ready_at && (
            <Text style={styles.date}>{formatDate(carga.ready_at)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

type Section =
  | { key: string; type: "header"; title: string }
  | { key: string; type: "empty"; text: string }
  | { key: string; type: "spacer" }
  | { key: string; type: "envio"; carga: MiCarga; active: boolean };

export function MisEnviosScreen({ navigation }: Props) {
  const [cargas, setCargas] = useState<MiCarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getMyLoads();
      setCargas(data);
      setError("");
    } catch {
      setError("No se pudieron cargar los envíos.");
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

  const enTransito = cargas.filter((c) => c.status === "in_transit");
  const historial = cargas.filter((c) => c.status === "delivered");

  const sections: Section[] = [
    { key: "header-transito", type: "header", title: "En tránsito" },
    ...(enTransito.length === 0
      ? [{ key: "empty-transito", type: "empty" as const, text: "No tenés envíos en tránsito" }]
      : enTransito.map((c) => ({ key: c.id, type: "envio" as const, carga: c, active: true }))),
    { key: "spacer", type: "spacer" },
    { key: "header-historial", type: "header", title: "Historial" },
    ...(historial.length === 0
      ? [{ key: "empty-historial", type: "empty" as const, text: "No tenés envíos entregados" }]
      : historial.map((c) => ({ key: c.id, type: "envio" as const, carga: c, active: false }))),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Envíos</Text>
        {!loading && !error && enTransito.length > 0 && (
          <Text style={styles.count}>{enTransito.length} en tránsito</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
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
              return <View style={styles.emptyBox}><Text style={styles.emptyText}>{item.text}</Text></View>;
            if (item.type === "spacer")
              return <View style={{ height: 8 }} />;
            return (
              <EnvioCard
                carga={item.carga}
                active={item.active}
                onPress={() => navigation.navigate("MiCargaDetalle", { carga: item.carga })}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.fontWeight.bold, color: colors.white },
  count: { fontSize: typography.size.sm, color: colors.brand },
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
  cardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandAlpha,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  city: { flex: 1, fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.white },
  arrow: { fontSize: typography.size.base, color: colors.textMuted },
  cargoType: { fontSize: typography.size.sm, color: colors.textSecondary },
  driver: { fontSize: typography.size.sm, color: colors.textMuted },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeActive: { borderColor: colors.brand },
  badgeDone: { borderColor: colors.textMuted },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.fontWeight.semibold },
  badgeTextActive: { color: colors.brand },
  badgeTextDone: { color: colors.textMuted },
  priceCol: { alignItems: "flex-end", gap: 2 },
  price: { fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.brandLight },
  date: { fontSize: typography.size.xs, color: colors.textMuted },
  emptyBox: { paddingVertical: 20, alignItems: "center", marginBottom: 10 },
  emptyText: { fontSize: typography.size.sm, color: colors.textMuted },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: typography.size.sm, color: colors.textMuted },
});
