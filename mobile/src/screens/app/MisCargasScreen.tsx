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
import { MisCargasStackParamList } from "./MainNavigator";

type Props = NativeStackScreenProps<MisCargasStackParamList, "MisCargasList">;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  available:  { label: "Sin ofertas", color: colors.textMuted },
  matched:    { label: "Asignada",    color: "#3b82f6" },
  in_transit: { label: "En tránsito", color: colors.brand },
  delivered:  { label: "Entregada",   color: colors.textMuted },
  cancelled:  { label: "Cancelada",   color: "#ef4444" },
};

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function CargaCard({ carga, onPress }: { carga: MiCarga; onPress: () => void }) {
  const badge = STATUS_BADGE[carga.status] ?? { label: carga.status, color: colors.textMuted };
  const hasOffers = carga.status === "available" && carga.offer_count > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.routeRow}>
        <Text style={styles.city} numberOfLines={1}>{carga.pickup_city}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.city} numberOfLines={1}>{carga.dropoff_city}</Text>
      </View>

      <View style={styles.tagsRow}>
        {carga.cargo_type ? (
          <View style={styles.tag}><Text style={styles.tagText}>{carga.cargo_type}</Text></View>
        ) : null}
        {carga.truck_type_required ? (
          <View style={styles.tag}><Text style={styles.tagText}>{carga.truck_type_required}</Text></View>
        ) : null}
        {carga.weight_kg ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {carga.weight_kg >= 1000
                ? `${(carga.weight_kg / 1000).toFixed(1)} t`
                : `${carga.weight_kg} kg`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { borderColor: badge.color }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {hasOffers ? `${carga.offer_count} oferta${carga.offer_count > 1 ? "s" : ""}` : badge.label}
            </Text>
          </View>
          {carga.accepted_offer && (
            <Text style={styles.driver} numberOfLines={1}>
              {carga.accepted_offer.driverName}
            </Text>
          )}
        </View>
        <View style={styles.priceCol}>
          {carga.price_base != null && (
            <Text style={styles.price}>
              ${Math.round(carga.price_base).toLocaleString("es-AR")}
            </Text>
          )}
          {carga.ready_at && (
            <Text style={styles.date}>Retiro {formatDate(carga.ready_at)}</Text>
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
  | { key: string; type: "carga"; carga: MiCarga };

export function MisCargasScreen({ navigation }: Props) {
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
      setError("No se pudieron cargar tus cargas.");
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

  const asignadas = cargas.filter((c) => c.status === "matched");
  const publicadas = cargas.filter((c) => c.status === "available");

  const sections: Section[] = [
    { key: "header-asignadas", type: "header", title: "Asignadas" },
    ...(asignadas.length === 0
      ? [{ key: "empty-asignadas", type: "empty" as const, text: "No tenés cargas asignadas" }]
      : asignadas.map((c) => ({ key: c.id, type: "carga" as const, carga: c }))),
    { key: "spacer", type: "spacer" },
    { key: "header-publicadas", type: "header", title: "Publicadas" },
    ...(publicadas.length === 0
      ? [{ key: "empty-publicadas", type: "empty" as const, text: "No tenés cargas publicadas" }]
      : publicadas.map((c) => ({ key: c.id, type: "carga" as const, carga: c }))),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cargas</Text>
        {!loading && !error && (
          <Text style={styles.count}>{cargas.filter((c) => c.status === "available" || c.status === "matched").length} activas</Text>
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
              <CargaCard
                carga={item.carga}
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
  count: { fontSize: typography.size.sm, color: colors.textMuted },
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
    gap: 8,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  city: { flex: 1, fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.white },
  arrow: { fontSize: typography.size.base, color: colors.textMuted },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  badgesRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.fontWeight.semibold },
  driver: { fontSize: typography.size.xs, color: colors.textMuted, flexShrink: 1 },
  priceCol: { alignItems: "flex-end", gap: 2 },
  price: { fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.brandLight },
  date: { fontSize: typography.size.xs, color: colors.textMuted },
  emptyBox: { paddingVertical: 20, alignItems: "center", marginBottom: 10 },
  emptyText: { fontSize: typography.size.sm, color: colors.textMuted },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: typography.size.sm, color: colors.textMuted },
});
