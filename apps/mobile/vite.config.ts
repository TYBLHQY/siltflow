import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
  },
  plugins: [react()],
  build: {
    minify: "esbuild",
  },
  server: {
    port: 5173,
  },
});
