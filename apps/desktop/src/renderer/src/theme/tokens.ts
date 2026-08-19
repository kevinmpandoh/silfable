export const themeTokens = {
  colors: {
    bg: "#FBFBFA",
    bgGradient: "linear-gradient(145deg, #FBFBFA, #FFF3EB)",
    panel: "#FFFFFF",
    panelSecondary: "#F4F4F1",
    panelElevated: "#FFF8F3",
    border: "rgba(32, 33, 42, 0.12)",
    borderHover: "rgba(223, 107, 34, 0.48)",
    textPrimary: "#20212A",
    textMuted: "#686970",
    textSubtle: "#8B8C91",
    primary: "#DF6B22",
    primaryHover: "#C95B18",
    primaryLight: "#F09A62",
    primaryGlow: "rgba(223, 107, 34, 0.18)",
    success: "#3F7E62",
    warning: "#B16A14",
    danger: "#ff5f6d",
    dangerGlow: "rgba(255, 95, 109, 0.3)",
  },
  fonts: {
    sans: '"Instrument Sans Variable", Aptos, ui-sans-serif, system-ui, sans-serif',
    mono: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
    serif: '"Instrument Serif", Georgia, ui-serif, serif',
  },
  radii: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "20px",
    full: "9999px",
  },
  shadows: {
    sm: "0 2px 8px rgba(0, 0, 0, 0.2)",
    md: "0 8px 24px rgba(0, 0, 0, 0.4)",
    lg: "0 24px 60px rgba(0, 0, 0, 0.6)",
    primaryGlow: "0 18px 45px rgba(255, 138, 0, 0.18)",
  },
} as const;

export type ThemeTokens = typeof themeTokens;
