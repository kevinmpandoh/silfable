import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ["@silfable/contracts"],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "[name].cjs",
          format: "cjs",
        },
      },
      externalizeDeps: {
        exclude: ["@silfable/contracts"],
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
