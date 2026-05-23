import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { colors, typography, radius } from "../theme";
import { Input, PasswordInput } from "../components/Input";
import { Button } from "../components/Button";
import { login, setAuth } from "../api";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Email inválido.");
      return;
    }
    if (!trimmedPassword) {
      setError("Ingresá tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(trimmedEmail, trimmedPassword);
      setAuth(data.access_token, data.user);
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al iniciar sesión.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          {/* Logo */}
          <Text style={styles.logo}>
            Carga<Text style={styles.logoAccent}>Back</Text>
          </Text>

          {/* Title */}
          <Text style={styles.title}>Iniciá sesión</Text>
          <Text style={styles.subtitle}>Ingresá con tu email y contraseña</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              required
            />

            <PasswordInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              required
            />

            <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>⚠ {error}</Text>
              </View>
            ) : null}

            <Button label="Ingresar →" onPress={handleLogin} loading={loading} />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
          </View>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>¿No tenés cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("RegisterRole")} activeOpacity={0.7}>
              <Text style={styles.registerLink}>Registrate gratis</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 32,
  },
  backText: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.fontWeight.semibold,
  },
  logo: {
    fontSize: typography.size.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  logoAccent: {
    color: colors.brandLight,
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
    marginBottom: 32,
  },
  form: {
    gap: 0,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: -8,
  },
  forgotText: {
    fontSize: typography.size.sm,
    color: colors.brand,
    fontWeight: typography.fontWeight.medium,
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
  divider: {
    marginVertical: 28,
  },
  dividerLine: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerText: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: typography.size.base,
    color: colors.brand,
    fontWeight: typography.fontWeight.bold,
  },
});
