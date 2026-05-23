import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { colors, typography, radius } from "../theme";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: { text: string; color: string };
  required?: boolean;
}

export function Input({ label, error, hint, required, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor="rgba(255,255,255,0.3)"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {hint && !error && (
        <Text style={[styles.hint, { color: hint.color }]}>{hint.text}</Text>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

export function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={[styles.passwordContainer, focused && styles.inputFocused, error && styles.inputError]}>
        <TextInput
          style={styles.passwordInput}
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity onPress={() => setVisible(!visible)} style={styles.eyeBtn}>
          <Text style={styles.eyeText}>{visible ? "Ocultar" : "Mostrar"}</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },
  inputError: {
    borderColor: "#fca5a5",
  },
  hint: {
    fontSize: typography.size.xs,
    marginTop: 4,
    fontWeight: typography.fontWeight.medium,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.error,
    marginTop: 4,
    fontWeight: typography.fontWeight.medium,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeText: {
    fontSize: typography.size.sm,
    color: colors.brand,
    fontWeight: typography.fontWeight.semibold,
  },
});
