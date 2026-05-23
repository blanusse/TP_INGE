export const colors = {
  bg: "#000",
  bgCard: "#111",
  bgInput: "#111",
  bgMuted: "#1a1a1a",

  brand: "#3a806b",
  brandDark: "#2a5e4f",
  brandLight: "#5cb899",
  brandAlpha: "rgba(58,128,107,0.15)",

  white: "#fff",
  textPrimary: "#fff",
  textSecondary: "rgba(255,255,255,0.7)",
  textMuted: "rgba(255,255,255,0.45)",

  border: "rgba(255,255,255,0.15)",
  borderFocus: "rgba(255,255,255,0.4)",

  error: "#ef4444",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",

  success: "#16a34a",
} as const;

export const typography = {
  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
  size: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 28,
  },
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
};
