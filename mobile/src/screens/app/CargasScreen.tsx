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
import { getAvailableLoads, Carga } from "../../api";
import { colors, typography, radius } from "../../theme";
import { CargasStackParamList } from "./MainNavigator";

type Props = {
  navigation: NativeStackNavigationProp<CargasStackParamList, "CargasList">;
};

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function CargaCard({ carga, onPress }: { carga: Carga; onPress: () => void }) {
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
        {carga.distance_km ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{Math.round(carga.distance_km)} km</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.price}>
          ${Math.round(carga.price_base).toLocaleString("es-AR")}
        </Text>
        {carga.ready_at ? (
          <Text style={styles.date}>Retiro {formatDate(carga.ready_at)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function CargasScreen({ navigation }: Props) {
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getAvailableLoads();
      setCargas(data);
      setError("");
    } catch {
      setError("No se pudieron cargar las cargas.");
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cargas disponibles</Text>
        {!loading && !error && (
          <Text style={styles.count}>{cargas.length} cargas</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      ) : cargas.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>No hay cargas disponibles</Text></View>
      ) : (
        <FlatList
          data={cargas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => (
            <CargaCard
              carga={item}
              onPress={() => navigation.navigate("CargaDetalle", { carga: item })}
            />
          )}
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
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  city: { flex: 1, fontSize: typography.size.md, fontWeight: typography.fontWeight.bold, color: colors.white },
  arrow: { fontSize: typography.size.base, color: colors.textMuted },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  price: { fontSize: typography.size.lg, fontWeight: typography.fontWeight.bold, color: colors.brandLight },
  date: { fontSize: typography.size.sm, color: colors.textMuted },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: typography.size.sm, color: colors.textMuted },
  emptyText: { fontSize: typography.size.sm, color: colors.textMuted },
});
