import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ["@silfable/contracts", "@silfable/core"],
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: {
        exclude: ["@silfable/contracts", "@silfable/core"],
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
