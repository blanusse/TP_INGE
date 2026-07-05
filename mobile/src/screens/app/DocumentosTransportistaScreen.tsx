import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, typography, radius } from "../../theme";
import { DocumentUploadCard } from "../../components/DocumentUploadCard";
import { verifyDocument, getUserProfile, getMyTrucks, verifyIdentity } from "../../api";

const documentosPersonales = [
  { key: "dni", label: "DNI (foto)", endpoint: "/documents/verify-dni" },
  { key: "license", label: "Registro de conducir", endpoint: "/documents/verify-license" },
  { key: "ructt", label: "Habilitación RUCTT", endpoint: "/documents/verify-ructt" },
];

const documentosCamion = (truckId: string) => [
  { key: "cedulaVerde", label: "Cédula Verde", endpoint: `/documents/verify-truck-cedula-verde/${truckId}` },
  { key: "vtv", label: "VTV", endpoint: `/documents/verify-truck-vtv/${truckId}` },
  { key: "seguro", label: "Seguro", endpoint: `/documents/verify-truck-seguro/${truckId}` },
];

export function DocumentosTransportistaScreen() {
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [trucks, setTrucks] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([getUserProfile(), getMyTrucks()]);
      setProfile(p);
      setTrucks(t);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const pickAndUpload = (docKey: string, endpoint: string) => {
    Alert.alert("Subir foto", "Elegí una opción", [
      {
        text: "Cámara",
        onPress: () => launchPicker(docKey, endpoint, "camera"),
      },
      {
        text: "Galería",
        onPress: () => launchPicker(docKey, endpoint, "gallery"),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const launchPicker = async (docKey: string, endpoint: string, source: "camera" | "gallery") => {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso denegado", "Se necesita acceso a la cámara.");
        return;
      }
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setLoading((l) => ({ ...l, [docKey]: true }));
    try {
      await verifyDocument(endpoint, uri);
      Alert.alert("Éxito", "Documento enviado correctamente.");
      await fetchData();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Error al enviar documento.");
    } finally {
      setLoading((l) => ({ ...l, [docKey]: false }));
    }
  };

  const handleVerifyIdentity = async () => {
    setLoading((l) => ({ ...l, identity: true }));
    try {
      const res = await verifyIdentity();
      Alert.alert(res.verified ? "Éxito" : "Resultado", res.message);
      await fetchData();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Error al verificar identidad.");
    } finally {
      setLoading((l) => ({ ...l, identity: false }));
    }
  };

  const isVerified = (key: string) => !!(profile as Record<string, unknown>)[`${key}_verified`];
  const getVencimiento = (truckId: string, key: string) => {
    const truck = trucks.find((t) => t.id === truckId) as Record<string, unknown> | undefined;
    if (!truck) return undefined;
    const val = truck[`${key}_vencimiento`];
    return typeof val === "string" ? val : undefined;
  };
  const isTruckDocVerified = (truckId: string, key: string) => {
    const truck = trucks.find((t) => t.id === truckId) as Record<string, unknown> | undefined;
    return !!(truck && truck[`${key}_verified`]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <Text style={styles.title}>Verificación de Documentos</Text>

      <Text style={styles.sectionTitle}>Documentos personales</Text>
      {documentosPersonales.map((doc) => (
        <DocumentUploadCard
          key={doc.key}
          label={doc.label}
          verified={isVerified(doc.key)}
          loading={!!loading[doc.key]}
          onUpload={() => pickAndUpload(doc.key, doc.endpoint)}
        />
      ))}

      {isVerified("dni") && (
        <View style={[styles.afipCard, { backgroundColor: isVerified("identity") ? "rgba(58,128,107,0.15)" : "rgba(234,179,8,0.1)" }]}>
          <Text style={styles.afipTitle}>Verificación de identidad (AFIP)</Text>
          {isVerified("identity") ? (
            <Text style={[styles.afipStatus, { color: colors.brand }]}>Identidad verificada contra AFIP</Text>
          ) : (
            <>
              <Text style={styles.afipDesc}>Validamos tu nombre contra el padrón de AFIP para confirmar tu identidad.</Text>
              {loading["identity"] ? (
                <ActivityIndicator color={colors.brand} style={{ marginTop: 10 }} />
              ) : (
                <TouchableOpacity style={styles.afipButton} onPress={handleVerifyIdentity}>
                  <Text style={styles.afipButtonText}>Verificar identidad</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {trucks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Documentos del camión</Text>
          {trucks.map((truck) => {
            const truckId = truck.id as string;
            const truckLabel = (truck.plate as string) ?? (truck.name as string) ?? `Camión ${truckId.slice(0, 6)}`;
            return (
              <View key={truckId} style={styles.truckBlock}>
                <Text style={styles.truckLabel}>{truckLabel}</Text>
                {documentosCamion(truckId).map((doc) => (
                  <DocumentUploadCard
                    key={`${truckId}-${doc.key}`}
                    label={doc.label}
                    verified={isTruckDocVerified(truckId, doc.key)}
                    loading={!!loading[`${truckId}-${doc.key}`]}
                    onUpload={() => pickAndUpload(`${truckId}-${doc.key}`, doc.endpoint)}
                    vencimiento={
                      (doc.key === "vtv" || doc.key === "seguro")
                        ? getVencimiento(truckId, doc.key)
                        : undefined
                    }
                  />
                ))}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.size.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 12,
    marginTop: 8,
  },
  truckBlock: { marginBottom: 16 },
  truckLabel: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 8,
  },
  afipCard: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  afipTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 8,
  },
  afipStatus: {
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.medium,
  },
  afipDesc: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginBottom: 10,
  },
  afipButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  afipButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.size.base,
  },
});
