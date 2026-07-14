import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../assets/pdf-viewer",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: "index.js",
        chunkFileNames: "index.js",
        assetFileNames: "index.[ext]",
      },
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
