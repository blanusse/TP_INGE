import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Carga, createOffer } from "../../api";
import { colors, typography, radius } from "../../theme";
import { CargasStackParamList } from "./MainNavigator";

type Props = NativeStackScreenProps<CargasStackParamList, "CargaDetalle">;

function formatPrice(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function getMapRegion(carga: Carga) {
  if (carga.pickup_lat && carga.dropoff_lat) {
    const minLat = Math.min(carga.pickup_lat, carga.dropoff_lat);
    const maxLat = Math.max(carga.pickup_lat, carga.dropoff_lat);
    const minLon = Math.min(carga.pickup_lon!, carga.dropoff_lon!);
    const maxLon = Math.max(carga.pickup_lon!, carga.dropoff_lon!);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.5),
      longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.5),
    };
  }
  return { latitude: -38.4, longitude: -63.6, latitudeDelta: 22, longitudeDelta: 22 };
}

export function CargaDetalleScreen({ route, navigation }: Props) {
  const { carga } = route.params;
  const [ofertaVisible, setOfertaVisible] = useState(false);
  const [price, setPrice] = useState(String(Math.round(carga.price_base)));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const hasCoords = !!(carga.pickup_lat && carga.dropoff_lat);

  const handleOfertar = async () => {
    const net = Number(price.replace(/\D/g, ""));
    if (!net || net <= 0) {
      Alert.alert("Precio inválido", "Ingresá un precio mayor a 0.");
      return;
    }
    setLoading(true);
    try {
      await createOffer({ loadId: carga.id, price: net, note: note.trim() || undefined });
      setOfertaVisible(false);
      Alert.alert("¡Oferta enviada!", "El dador de carga recibirá tu propuesta.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al enviar la oferta.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerRoute} numberOfLines={1}>
            {carga.pickup_city} → {carga.dropoff_city}
          </Text>
          {carga.shipper?.razon_social ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {carga.shipper.razon_social}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={getMapRegion(carga)}
            userInterfaceStyle="dark"
            scrollEnabled={false}
            zoomEnabled={false}
          >
            {hasCoords && (
              <>
                <Marker
                  coordinate={{ latitude: carga.pickup_lat!, longitude: carga.pickup_lon! }}
                  title="Retiro"
                  description={carga.pickup_exact ?? carga.pickup_city}
                  pinColor={colors.brand}
                />
                <Marker
                  coordinate={{ latitude: carga.dropoff_lat!, longitude: carga.dropoff_lon! }}
                  title="Entrega"
                  description={carga.dropoff_exact ?? carga.dropoff_city}
                  pinColor="#ef4444"
                />
                <Polyline
                  coordinates={[
                    { latitude: carga.pickup_lat!, longitude: carga.pickup_lon! },
                    { latitude: carga.dropoff_lat!, longitude: carga.dropoff_lon! },
                  ]}
                  strokeColor={colors.brand}
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              </>
            )}
          </MapView>
        </View>

        {/* Price highlight */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Precio base</Text>
          <Text style={styles.priceValue}>{formatPrice(carga.price_base)}</Text>
          <Text style={styles.priceNote}>Podés hacer una contraoferta</Text>
        </View>

        {/* Info rows */}
        <View style={styles.infoSection}>
          <InfoRow icon="📍" label="Retiro" value={carga.pickup_exact ?? carga.pickup_city} />
          <InfoRow icon="🏁" label="Entrega" value={carga.dropoff_exact ?? carga.dropoff_city} />
          {carga.ready_at && (
            <InfoRow icon="📅" label="Fecha retiro" value={formatDate(carga.ready_at) ?? "-"} />
          )}
          {carga.cargo_type && (
            <InfoRow icon="📦" label="Tipo de carga" value={carga.cargo_type} />
          )}
          {carga.weight_kg && (
            <InfoRow
              icon="⚖️"
              label="Peso"
              value={carga.weight_kg >= 1000
                ? `${(carga.weight_kg / 1000).toFixed(1)} t`
                : `${carga.weight_kg} kg`}
            />
          )}
          {carga.distance_km && (
            <InfoRow icon="🛣️" label="Distancia" value={`${Math.round(carga.distance_km)} km`} />
          )}
          {carga.truck_type_required && (
            <InfoRow icon="🚛" label="Camión requerido" value={carga.truck_type_required} />
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.ofertarBtn}
          onPress={() => setOfertaVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.ofertarText}>Hacer oferta</Text>
        </TouchableOpacity>
      </View>

      {/* Offer modal */}
      <Modal
        visible={ofertaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOfertaVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setOfertaVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tu oferta</Text>
            <Text style={styles.modalSub}>
              Ingresá el precio que querés recibir (neto, después de comisión)
            </Text>

            <Text style={styles.fieldLabel}>Precio neto ($)</Text>
            <View style={styles.priceInputRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Ej: Disponible para retiro inmediato"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleOfertar}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Enviar oferta</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={rowStyles.text}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  icon: { fontSize: 18, marginTop: 2 },
  text: { flex: 1 },
  label: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: typography.size.base, color: colors.white, fontWeight: typography.fontWeight.medium },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.white, fontSize: 18 },
  headerCenter: { flex: 1 },
  headerRoute: { fontSize: typography.size.base, fontWeight: typography.fontWeight.bold, color: colors.white },
  headerSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  content: { paddingBottom: 100 },
  mapContainer: { height: 200 },
  map: { ...StyleSheet.absoluteFillObject },
  priceCard: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.brandAlpha,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.md,
    alignItems: "center",
    gap: 4,
  },
  priceLabel: { fontSize: typography.size.xs, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  priceValue: { fontSize: 32, fontWeight: typography.fontWeight.extrabold, color: colors.brandLight },
  priceNote: { fontSize: typography.size.xs, color: colors.textMuted },
  infoSection: { paddingHorizontal: 20 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  ofertarBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
  },
  ofertarText: { fontSize: typography.size.base, fontWeight: typography.fontWeight.bold, color: colors.white },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: typography.size.xl, fontWeight: typography.fontWeight.bold, color: colors.white, marginBottom: 6 },
  modalSub: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: 24 },
  fieldLabel: { fontSize: typography.size.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  currencyPrefix: { fontSize: typography.size.xl, color: colors.textSecondary, marginRight: 4 },
  priceInput: {
    flex: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    paddingVertical: 12,
  },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: typography.size.base,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: typography.size.base, fontWeight: typography.fontWeight.bold, color: colors.white },
});
