import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const rendererSource = fileURLToPath(new URL("./src/renderer/src", import.meta.url));
const bufferutilStub = fileURLToPath(new URL("./src/main/stubs/bufferutil.js", import.meta.url));
const utf8ValidateStub = fileURLToPath(new URL("./src/main/stubs/utf-8-validate.js", import.meta.url));

export default defineConfig({
  main: {
    resolve: {
      alias: {
        bufferutil: bufferutilStub,
        "utf-8-validate": utf8ValidateStub,
      },
    },
    build: {
      externalizeDeps: {
        exclude: ["@mirae/contracts"],
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        bufferutil: bufferutilStub,
        "utf-8-validate": utf8ValidateStub,
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "[name].cjs",
          format: "cjs",
        },
      },
      externalizeDeps: {
        exclude: ["@mirae/contracts"],
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": rendererSource,
      },
    },
  },
});
