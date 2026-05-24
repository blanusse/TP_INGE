import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { createLoad } from "../../api";
import { colors, typography, radius } from "../../theme";

// TabParamList local para tipar la navegación sin importar el archivo completo
type TabParamList = {
  MisCargasTab: undefined;
  NuevaCargaTab: undefined;
  MisEnviosTab: undefined;
  Perfil: undefined;
};

type Props = {
  navigation: BottomTabNavigationProp<TabParamList, "NuevaCargaTab">;
};

type FormState = {
  pickup_city: string;
  dropoff_city: string;
  cargo_type: string;
  truck_type_required: string;
  weight_kg: string;
  price_base: string;
  ready_at: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  pickup_city: "",
  dropoff_city: "",
  cargo_type: "",
  truck_type_required: "",
  weight_kg: "",
  price_base: "",
  ready_at: "",
  description: "",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

export function NuevaCargaScreen({ navigation }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.pickup_city.trim() || !form.dropoff_city.trim()) {
      Alert.alert("Campos requeridos", "Origen y destino son obligatorios.");
      return;
    }
    if (!form.price_base.trim()) {
      Alert.alert("Campos requeridos", "El precio base es obligatorio.");
      return;
    }

    const price = parseFloat(form.price_base);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Error", "El precio debe ser un número mayor a 0.");
      return;
    }

    const weight = form.weight_kg.trim() ? parseFloat(form.weight_kg) : undefined;
    if (weight !== undefined && (isNaN(weight) || weight <= 0)) {
      Alert.alert("Error", "El peso debe ser un número mayor a 0.");
      return;
    }

    let ready_at: string | undefined;
    if (form.ready_at.trim()) {
      const d = new Date(form.ready_at.trim());
      if (isNaN(d.getTime())) {
        Alert.alert("Error", "La fecha debe tener formato DD/MM/AAAA.");
        return;
      }
      ready_at = d.toISOString();
    }

    setSaving(true);
    try {
      await createLoad({
        pickup_city: form.pickup_city.trim(),
        dropoff_city: form.dropoff_city.trim(),
        cargo_type: form.cargo_type.trim() || undefined,
        truck_type_required: form.truck_type_required.trim() || undefined,
        weight_kg: weight,
        price_base: price,
        ready_at,
        description: form.description.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      Alert.alert("¡Carga publicada!", "Tu carga ya está disponible para transportistas.", [
        { text: "Ver mis cargas", onPress: () => navigation.navigate("MisCargasTab") },
      ]);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nueva carga</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Field label="Ciudad de origen" required>
            <TextInput
              style={styles.input}
              value={form.pickup_city}
              onChangeText={set("pickup_city")}
              placeholder="Ej: Buenos Aires"
              placeholderTextColor={colors.textMuted}
            />
          </Field>

          <Field label="Ciudad de destino" required>
            <TextInput
              style={styles.input}
              value={form.dropoff_city}
              onChangeText={set("dropoff_city")}
              placeholder="Ej: Rosario"
              placeholderTextColor={colors.textMuted}
            />
          </Field>

          <Field label="Precio base ($)" required>
            <TextInput
              style={styles.input}
              value={form.price_base}
              onChangeText={set("price_base")}
              placeholder="Ej: 150000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </Field>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Tipo de carga">
                <TextInput
                  style={styles.input}
                  value={form.cargo_type}
                  onChangeText={set("cargo_type")}
                  placeholder="Ej: Granos"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Tipo de camión">
                <TextInput
                  style={styles.input}
                  value={form.truck_type_required}
                  onChangeText={set("truck_type_required")}
                  placeholder="Ej: Furgón"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Peso (kg)">
                <TextInput
                  style={styles.input}
                  value={form.weight_kg}
                  onChangeText={set("weight_kg")}
                  placeholder="Ej: 5000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Fecha de retiro">
                <TextInput
                  style={styles.input}
                  value={form.ready_at}
                  onChangeText={set("ready_at")}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>
            </View>
          </View>

          <Field label="Descripción">
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={form.description}
              onChangeText={set("description")}
              placeholder="Información adicional sobre la carga..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </Field>

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.submitText}>Publicar carga</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  row2: { flexDirection: "row", gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.fontWeight.medium, textTransform: "uppercase", letterSpacing: 0.5 },
  required: { color: "#ef4444" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.size.sm,
    color: colors.white,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  inputMulti: { height: 80, textAlignVertical: "top", paddingTop: 10 },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: typography.size.base, fontWeight: typography.fontWeight.bold, color: colors.bg },
});
