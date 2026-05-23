import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { colors, typography, radius } from "../theme";
import { Input, PasswordInput } from "../components/Input";
import { Button } from "../components/Button";
import { register, checkField, verifyInvitationToken } from "../api";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RegisterForm">;
  route: RouteProp<RootStackParamList, "RegisterForm">;
};

function passwordStrength(pwd: string): number {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}

const strengthColors = ["#d1d5db", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"];
const strengthLabels = ["", "Muy débil", "Débil", "Buena", "Muy segura"];

export function RegisterFormScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isEmpleado = role === "empleado";

  // Empleado: token step
  const [tokenStep, setTokenStep] = useState(isEmpleado);
  const [token, setToken] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [ownerName, setOwnerName] = useState("");

  // Form fields
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Real-time availability
  const [emailDisponible, setEmailDisponible] = useState<boolean | null>(null);
  const [dniDisponible, setDniDisponible] = useState<boolean | null>(null);
  const [telefonoDisponible, setTelefonoDisponible] = useState<boolean | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check email availability
  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailDisponible(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await checkField("email", email);
        setEmailDisponible(r.available);
      } catch { /* ignorar */ }
    }, 600);
    return () => clearTimeout(t);
  }, [email]);

  // Check DNI availability
  useEffect(() => {
    if (!/^\d{7,8}$/.test(dni)) { setDniDisponible(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await checkField("dni", dni);
        setDniDisponible(r.available);
      } catch { /* ignorar */ }
    }, 700);
    return () => clearTimeout(t);
  }, [dni]);

  // Check phone availability
  useEffect(() => {
    const clean = telefono.replace(/[\s-]/g, "");
    if (!/^\d{8,15}$/.test(clean)) { setTelefonoDisponible(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await checkField("phone", clean);
        setTelefonoDisponible(r.available);
      } catch { /* ignorar */ }
    }, 600);
    return () => clearTimeout(t);
  }, [telefono]);

  const handleVerificarToken = async () => {
    setTokenError("");
    if (!token.trim()) { setTokenError("Ingresá el código de invitación."); return; }
    setTokenLoading(true);
    try {
      const data = await verifyInvitationToken(token);
      setOwnerName(data.ownerName);
      setTokenStep(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("utilizada")) {
        setTokenError("Este código ya fue utilizado.");
      } else if (msg.toLowerCase().includes("vencido")) {
        setTokenError("Este código de invitación ha vencido.");
      } else {
        setTokenError("Código de invitación no válido. Verificá el enlace.");
      }
    } finally {
      setTokenLoading(false);
    }
  };

  const validar = (): string | null => {
    if (!nombre.trim()) return "Ingresá tu nombre completo.";
    if (!/^\d{7,8}$/.test(dni)) return "El DNI debe tener 7 u 8 dígitos.";
    if (dniDisponible === false) return "Ya existe una cuenta con ese DNI.";
    if (!telefono.trim()) return "El teléfono es obligatorio.";
    if (!/^\d{8,15}$/.test(telefono.replace(/[\s-]/g, ""))) return "El teléfono debe tener entre 8 y 15 dígitos.";
    if (telefonoDisponible === false) return "Ya existe una cuenta con ese teléfono.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email inválido.";
    if (emailDisponible === false) return "Ya existe una cuenta con ese email.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!aceptaTerminos) return "Aceptá los términos para continuar.";
    return null;
  };

  const handleRegistro = async () => {
    setError("");
    const err = validar();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      await register({
        email,
        password,
        name: nombre,
        role,
        phone: telefono.replace(/[\s-]/g, ""),
        dni,
        invitation_token: isEmpleado ? token.trim() : undefined,
      });
      Alert.alert(
        "¡Cuenta creada!",
        "Revisá tu email para verificar tu cuenta antes de ingresar.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const pwdScore = passwordStrength(password);

  // ── TOKEN STEP (solo empleado) ────────────────────────────────────────────
  if (tokenStep) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>Carga<Text style={styles.logoAccent}>Back</Text></Text>
          <Text style={styles.title}>Empleado de flota</Text>
          <Text style={styles.subtitle}>Ingresá el código que te envió el dueño de la flota.</Text>

          <Input
            label="Código de invitación"
            value={token}
            onChangeText={setToken}
            placeholder="Ej: a1b2c3d4-e5f6-..."
            autoCapitalize="none"
            autoCorrect={false}
            required
          />

          {tokenError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>⚠ {tokenError}</Text>
            </View>
          ) : null}

          <Button
            label="Verificar código →"
            onPress={handleVerificarToken}
            loading={tokenLoading}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── FORM STEP ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => isEmpleado ? setTokenStep(true) : navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>Carga<Text style={styles.logoAccent}>Back</Text></Text>

          {/* Role badge */}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {role === "transportista" ? "🚛 Transportista individual" : `👷 Empleado${ownerName ? ` · Flota de ${ownerName}` : ""}`}
            </Text>
          </View>

          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Completá tus datos para registrarte.</Text>

          <Input
            label="Nombre y apellido"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Juan Rodríguez"
            autoCapitalize="words"
            autoComplete="name"
            required
          />

          <Input
            label="DNI"
            value={dni}
            onChangeText={(v) => setDni(v.replace(/\D/g, ""))}
            placeholder="12345678"
            keyboardType="numeric"
            maxLength={8}
            required
            hint={
              dniDisponible === false
                ? { text: "⚠ Ya existe una cuenta con ese DNI.", color: colors.error }
                : dniDisponible === true
                ? { text: "✓ DNI disponible.", color: colors.success }
                : undefined
            }
          />

          <Input
            label="Celular"
            value={telefono}
            onChangeText={(v) => setTelefono(v.replace(/[^\d\s-]/g, ""))}
            placeholder="9 11 1234-5678"
            keyboardType="phone-pad"
            maxLength={15}
            required
            hint={
              telefonoDisponible === false
                ? { text: "⚠ Este celular ya está registrado.", color: colors.error }
                : telefonoDisponible === true
                ? { text: "✓ Celular disponible.", color: colors.success }
                : undefined
            }
          />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            required
            hint={
              emailDisponible === false
                ? { text: "⚠ Este email ya está registrado.", color: colors.error }
                : emailDisponible === true
                ? { text: "✓ Email disponible.", color: colors.success }
                : undefined
            }
          />

          {/* Password separator */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorLabel}>CONTRASEÑA</Text>
            <View style={styles.separatorLine} />
          </View>

          <PasswordInput
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            required
          />

          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map((n) => (
                  <View
                    key={n}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: pwdScore >= n ? strengthColors[pwdScore] : "rgba(255,255,255,0.1)" },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strengthColors[pwdScore] }]}>
                {strengthLabels[pwdScore]}
              </Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>⚠ {error}</Text>
            </View>
          ) : null}

          {/* Terms */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAceptaTerminos(!aceptaTerminos)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, aceptaTerminos && styles.checkboxChecked]}>
              {aceptaTerminos && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              Acepto los{" "}
              <Text style={styles.termsLink}>términos y condiciones</Text>
              {" "}y la{" "}
              <Text style={styles.termsLink}>política de privacidad</Text>
            </Text>
          </TouchableOpacity>

          <Button
            label="Crear cuenta →"
            onPress={handleRegistro}
            loading={loading}
            disabled={!aceptaTerminos}
            style={{ marginTop: 8 }}
          />

          {/* Divider */}
          <View style={styles.dividerLine} />

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>¿Ya tenés cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Iniciá sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
  },
  backText: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.semibold,
  },
  logo: {
    fontSize: typography.size.xl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  logoAccent: { color: colors.brandLight },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandAlpha,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  roleBadgeText: {
    fontSize: typography.size.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.brand,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    marginBottom: 28,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 20,
  },
  separatorLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.border,
  },
  separatorLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.5,
  },
  strengthContainer: {
    marginTop: -8,
    marginBottom: 16,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    fontSize: typography.size.sm,
    color: "#b91c1c",
    fontWeight: typography.fontWeight.medium,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },
  termsText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.brand,
    fontWeight: typography.fontWeight.semibold,
  },
  dividerLine: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.fontWeight.bold,
  },
});
