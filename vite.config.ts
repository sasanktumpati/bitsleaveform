import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  build: {
    sourcemap: false,
    cssMinify: true,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/docx/")) {
            return "docx-vendor";
          }
          if (id.includes("/node_modules/pdf-lib/")) {
            return "pdf-vendor";
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
