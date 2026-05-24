import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, typography, radius } from "../../theme";
import { getUserProfile, verifyDocument, verifyIdentity } from "../../api";
import { DocumentUploadCard } from "../../components/DocumentUploadCard";

const documentosPersonales = [
  { key: "dni", label: "DNI (foto)", endpoint: "/documents/verify-dni" },
  { key: "license", label: "Registro de conducir", endpoint: "/documents/verify-license" },
  { key: "cedulaAzul", label: "Cédula Azul", endpoint: "/documents/verify-cedula-azul" },
];

export function DocumentosEmpleadoScreen() {
  const [verifiedDocs, setVerifiedDocs] = useState<Record<string, boolean>>({});
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        const verified: Record<string, boolean> = {};
        for (const doc of documentosPersonales) {
          verified[doc.key] = !!profile[`${doc.key}_verified`];
        }
        verified["identity"] = !!profile["identity_verified"];
        setVerifiedDocs(verified);
      }
    } catch {
      // silently fail on profile fetch
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpload = async (docKey: string, endpoint: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setLoadingDoc(docKey);
    try {
      await verifyDocument(endpoint, result.assets[0].uri);
      setVerifiedDocs((prev) => ({ ...prev, [docKey]: true }));
      Alert.alert("Éxito", "Documento enviado correctamente.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir el documento.";
      Alert.alert("Error", message);
    } finally {
      setLoadingDoc(null);
    }
  };

  const showPickerOptions = (docKey: string, endpoint: string) => {
    Alert.alert("Subir foto", "Elegí una opción", [
      {
        text: "Cámara",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permiso denegado", "Se necesita acceso a la cámara.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
          });
          if (result.canceled || !result.assets?.[0]) return;
          setLoadingDoc(docKey);
          try {
            await verifyDocument(endpoint, result.assets[0].uri);
            setVerifiedDocs((prev) => ({ ...prev, [docKey]: true }));
            Alert.alert("Éxito", "Documento enviado correctamente.");
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al subir el documento.";
            Alert.alert("Error", message);
          } finally {
            setLoadingDoc(null);
          }
        },
      },
      {
        text: "Galería",
        onPress: () => handleUpload(docKey, endpoint),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleVerifyIdentity = async () => {
    setVerifyingIdentity(true);
    try {
      await verifyIdentity();
      setVerifiedDocs((prev) => ({ ...prev, identity: true }));
      Alert.alert("Éxito", "Identidad verificada contra AFIP.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al verificar identidad.";
      Alert.alert("Error", message);
    } finally {
      setVerifyingIdentity(false);
    }
  };

  const dniVerified = !!verifiedDocs["dni"];
  const identityVerified = !!verifiedDocs["identity"];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verificar documentos</Text>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Documentos personales</Text>
        {documentosPersonales.map((doc) => (
          <DocumentUploadCard
            key={doc.key}
            label={doc.label}
            verified={!!verifiedDocs[doc.key]}
            loading={loadingDoc === doc.key}
            onUpload={() => showPickerOptions(doc.key, doc.endpoint)}
          />
        ))}

        {dniVerified && (
          <View style={[styles.afipCard, identityVerified ? styles.afipVerified : styles.afipPending]}>
            <Text style={styles.afipTitle}>Verificación de identidad (AFIP)</Text>
            {identityVerified ? (
              <Text style={styles.afipVerifiedText}>Identidad verificada contra AFIP</Text>
            ) : (
              <>
                <Text style={styles.afipDescription}>
                  Validamos tu nombre contra el padrón de AFIP para confirmar tu identidad.
                </Text>
                {verifyingIdentity ? (
                  <ActivityIndicator color={colors.brand} style={{ marginTop: 12 }} />
                ) : (
                  <TouchableOpacity style={styles.afipButton} onPress={handleVerifyIdentity} activeOpacity={0.8}>
                    <Text style={styles.afipButtonText}>Verificar identidad</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 60,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontWeight: typography.fontWeight.bold,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  afipCard: {
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 8,
  },
  afipVerified: {
    backgroundColor: "rgba(22,163,74,0.15)",
  },
  afipPending: {
    backgroundColor: "rgba(234,179,8,0.15)",
  },
  afipTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 8,
  },
  afipVerifiedText: {
    color: colors.success,
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.semibold,
  },
  afipDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    lineHeight: 20,
  },
  afipButton: {
    marginTop: 12,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  afipButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.size.base,
  },
});
