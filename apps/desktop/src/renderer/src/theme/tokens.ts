export const themeTokens = {
  colors: {
    bg: "#070914",
    bgGradient: "linear-gradient(180deg, #080a15, #070914)",
    panel: "#0b0e1c",
    panelSecondary: "#101426",
    panelElevated: "#171b31",
    border: "rgba(148, 163, 184, 0.16)",
    borderHover: "rgba(123, 162, 255, 0.35)",
    textPrimary: "#eef2ff",
    textMuted: "#7f8aa7",
    textSubtle: "#49546f",
    primary: "#3157ff",
    primaryHover: "#456cff",
    primaryLight: "#7ba2ff",
    primaryGlow: "rgba(49, 87, 255, 0.34)",
    success: "#20d880",
    warning: "#f7b733",
    danger: "#ff5f6d",
    dangerGlow: "rgba(255, 95, 109, 0.3)",
  },
  fonts: {
    sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    serif: 'Georgia, serif',
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
    primaryGlow: "0 0 40px rgba(49, 87, 255, 0.25)",
  },
} as const;

export type ThemeTokens = typeof themeTokens;
