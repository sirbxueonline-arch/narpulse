// NarPulse brand tokens — light theme, mirrors the web app.

export const theme = {
  colors: {
    bg: "#fafaf6",
    surface: "#ffffff",
    surface2: "#f4f1e9",
    border: "#e6e2d6",
    borderStrong: "#d6d1c2",
    text: "#1a1f2e",
    textSoft: "#4a5266",
    muted: "#6e7484",
    accent: "#c8102e",
    accent2: "#a50c24",
    accentSoft: "#fde8ec",
    success: "#138a5b",
    successSoft: "#def5e8",
    warning: "#b87514",
    warningSoft: "#fff1d9",
    water: "#3aa1ff",
    electric: "#f2b441",
    gas: "#e63950",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
  },
  shadow: {
    sm: {
      shadowColor: "#1c1810",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#1c1810",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    lg: {
      shadowColor: "#1c1810",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 6,
    },
  },
} as const;

export const NARIMANOV_CENTER = { latitude: 40.407, longitude: 49.86 };
export const NARIMANOV_DELTA = { latitudeDelta: 0.028, longitudeDelta: 0.035 };

export function utilityColor(utility: "water" | "electricity" | "gas") {
  return utility === "water"
    ? theme.colors.water
    : utility === "electricity"
    ? theme.colors.electric
    : theme.colors.gas;
}

export function severityColor(median: number | null) {
  if (median == null) return theme.colors.muted;
  if (median >= 25) return theme.colors.accent;
  if (median >= 12) return theme.colors.warning;
  return theme.colors.success;
}
