export const themeTokens = {
  colors: {
    bg: "#06121a",
    bgGradient: "linear-gradient(145deg, #06121a, #09252c)",
    panel: "#0a1c25",
    panelSecondary: "#102a32",
    panelElevated: "#123640",
    border: "rgba(120, 230, 197, 0.16)",
    borderHover: "rgba(57, 217, 138, 0.42)",
    textPrimary: "#edfdf8",
    textMuted: "#91aaa8",
    textSubtle: "#56716d",
    primary: "#20c997",
    primaryHover: "#45e0ae",
    primaryLight: "#62d9df",
    primaryGlow: "rgba(32, 201, 151, 0.34)",
    success: "#39d98a",
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
