import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/content/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background, #fbfbfa)",
        foreground: "var(--foreground, #20212a)",
        primary: {
          DEFAULT: "var(--primary, #df6b22)",
          foreground: "var(--primary-foreground, #ffffff)",
        },
        secondary: {
          DEFAULT: "var(--secondary, #f4f4f1)",
          foreground: "var(--secondary-foreground, #20212a)",
        },
        muted: {
          DEFAULT: "var(--muted, #f4f4f1)",
          foreground: "var(--muted-foreground, #686970)",
        },
        accent: {
          DEFAULT: "var(--accent, #fff3eb)",
          foreground: "var(--accent-foreground, #df6b22)",
        },
        border: "var(--border, rgb(32 33 42 / 0.12))",
        ink: "#06121A",
        paper: "#EDFDF8",
        electric: "#20C997",
      },
      boxShadow: {
        soft: "var(--soft-shadow, 0 18px 40px -18px rgb(223 107 34 / 0.42))",
      },
      fontFamily: {
        display: ["var(--font-display)", "Instrument Sans Variable", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Instrument Serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Instrument Sans Variable", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [typography],
};

export default config;
