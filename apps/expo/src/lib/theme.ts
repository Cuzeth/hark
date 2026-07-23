export const colors = {
  paper: "#FAFAF9",
  surface: "#FFFFFF",
  ink: "#171713",
  muted: "#6B6A63",
  soft: "#A3A199",
  line: "#E7E5E0",
  accent: "#035B49",
  accentPressed: "#02493B",
  accentSoft: "#E7F0ED",
  danger: "#C93B2C",
} as const;

export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  mono: "Menlo",
} as const;

/** React Native letterSpacing is measured in points, so convert -2% per size. */
export const tightTracking = (fontSize: number) => fontSize * -0.02;
