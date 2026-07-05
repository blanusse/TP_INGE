import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors, typography, radius } from "../../theme";
import { getMyTrucks, createTruck, deleteTruck } from "../../api";

const TRUCK_TYPES = [
  { value: "camion", label: "Camión" },
  { value: "semi", label: "Semi" },
  { value: "frigorifico", label: "Frigorífico" },
  { value: "cisterna", label: "Cisterna" },
  { value: "acoplado", label: "Acoplado" },
  { value: "otros", label: "Otros" },
];

type Truck = {
  id: string;
  patente?: string;
  truck_type?: string;
  marca?: string;
  modelo?: string;
  año?: number;
  capacity_kg?: number;
};

export function CamionesScreen() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [patente, setPatente] = useState("");
  const [truckType, setTruckType] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [año, setAño] = useState("");
  const [capacidad, setCapacidad] = useState("");

  const fetchTrucks = useCallback(async () => {
    try {
      const data = await getMyTrucks();
      setTrucks(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchTrucks(); }, [fetchTrucks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrucks();
    setRefreshing(false);
  };

  const resetForm = () => {
    setPatente("");
    setTruckType("");
    setMarca("");
    setModelo("");
    setAño("");
    setCapacidad("");
  };

  const handleAdd = async () => {
    const pat = patente.trim().toUpperCase();
    if (!pat) { Alert.alert("Error", "La patente es obligatoria."); return; }
    if (!truckType) { Alert.alert("Error", "Seleccioná el tipo de camión."); return; }

    setSaving(true);
    try {
      await createTruck({
        patente: pat,
        truck_type: truckType,
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        año: año ? Number(año) : undefined,
        capacity_kg: capacidad ? Number(capacidad) : undefined,
      });
      setModalVisible(false);
      resetForm();
      await fetchTrucks();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Error al agregar camión.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (truck: Truck) => {
    Alert.alert(
      "Eliminar camión",
      `¿Seguro que querés eliminar el camión ${truck.patente ?? truck.id}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTruck(truck.id);
              await fetchTrucks();
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Error al eliminar.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Camiones</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {trucks.length === 0 && (
          <Text style={styles.empty}>No tenés camiones registrados.</Text>
        )}
        {trucks.map((truck) => (
          <View key={truck.id} style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardPatente}>{truck.patente ?? "Sin patente"}</Text>
              <TouchableOpacity onPress={() => handleDelete(truck)}>
                <Text style={styles.deleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardDetail}>
              {[truck.marca, truck.modelo, truck.año].filter(Boolean).join(" ") || "Sin detalles"}
            </Text>
            <Text style={styles.cardDetail}>
              Tipo: {TRUCK_TYPES.find((t) => t.value === truck.truck_type)?.label ?? truck.truck_type ?? "-"}
            </Text>
            {truck.capacity_kg && (
              <Text style={styles.cardDetail}>Capacidad: {truck.capacity_kg} kg</Text>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Agregar camión</Text>

            <TextInput
              style={styles.input}
              placeholder="Patente *"
              placeholderTextColor={colors.textMuted}
              value={patente}
              onChangeText={setPatente}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Tipo de camión *</Text>
            <View style={styles.typeRow}>
              {TRUCK_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, truckType === t.value && styles.typeChipActive]}
                  onPress={() => setTruckType(t.value)}
                >
                  <Text style={[styles.typeChipText, truckType === t.value && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Marca"
              placeholderTextColor={colors.textMuted}
              value={marca}
              onChangeText={setMarca}
            />
            <TextInput
              style={styles.input}
              placeholder="Modelo"
              placeholderTextColor={colors.textMuted}
              value={modelo}
              onChangeText={setModelo}
            />
            <TextInput
              style={styles.input}
              placeholder="Año"
              placeholderTextColor={colors.textMuted}
              value={año}
              onChangeText={setAño}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Capacidad (kg)"
              placeholderTextColor={colors.textMuted}
              value={capacidad}
              onChangeText={setCapacidad}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              {saving ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.fontWeight.bold, color: colors.white },
  addBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addBtnText: { color: "#fff", fontWeight: typography.fontWeight.semibold, fontSize: typography.size.sm },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40, fontSize: typography.size.base },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardPatente: { color: colors.textPrimary, fontSize: typography.size.lg, fontWeight: typography.fontWeight.bold },
  cardDetail: { color: colors.textSecondary, fontSize: typography.size.sm, marginTop: 2 },
  deleteText: { color: colors.error, fontSize: typography.size.sm, fontWeight: typography.fontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 24 },
  modalTitle: { color: colors.textPrimary, fontSize: typography.size.xl, fontWeight: typography.fontWeight.bold, marginBottom: 16 },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.textPrimary,
    fontSize: typography.size.base,
    marginBottom: 12,
  },
  label: { color: colors.textSecondary, fontSize: typography.size.sm, marginBottom: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChipText: { color: colors.textSecondary, fontSize: typography.size.sm },
  typeChipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 8, gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText: { color: colors.textSecondary, fontSize: typography.size.base },
  saveBtn: { backgroundColor: colors.brand, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.md },
  saveBtnText: { color: "#fff", fontWeight: typography.fontWeight.semibold, fontSize: typography.size.base },
});
