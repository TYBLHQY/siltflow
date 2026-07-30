import type { KnipConfig } from "knip";

const config: KnipConfig = {
  // Electron multi-entry: main process, preload, renderer
  entry: [
    "electron/main.ts",
    "electron/preload.ts",
    "src/main.tsx",
    "index.html",
  ],

  // All source files to analyze
  project: ["electron/**/*.ts", "src/**/*.{ts,tsx}"],

  // Compiled extensions not tracked for imports
  compilers: {
    css: () => [],
    json5: () => [],
  },

  // Files to exclude from analysis
  ignore: ["scripts/gen-fake-data.mjs"],

  // Dependencies used in config files / build tools only
  ignoreDependencies: [
    // Electron runtime - used by electron-builder and vite-plugin-electron
    "electron",
    // Type-only package references
    "@types/better-sqlite3",
    "@types/dom-speech-recognition",
    // Vite plugins (used in vite.config.ts)
    "@tailwindcss/vite",
    "vite-plugin-electron",
    "vite-plugin-electron-renderer",
    "@vitejs/plugin-react",
    // Tailwind (used in vite.config.ts)
    "@catppuccin/tailwindcss",
    "tailwindcss",
    "tailwindcss-animate",
    // shadcn/ui dependencies (used via components.json / npx shadcn)
    "@radix-ui/react-popover",
    "@radix-ui/react-separator",
    "@radix-ui/react-slot",
    // Native module loader (used by better-sqlite3 internally)
    "prebuild-install",
    "bindings",
    // ESLint plugins (used in eslint.config.mjs)
    "typescript-eslint",
    "eslint-plugin-react-hooks",
    "eslint-plugin-react-refresh",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    // Testing (used in vitest setup)
    "@testing-library/react",
    // Dev tools
    "electron-devtools-installer",
    // Drizzle ORM (used in electron/database/)
    "drizzle-orm",
    "better-sqlite3",
    // Coverage (used in vitest.config.ts)
    "@vitest/coverage-v8",
    // Audit tools (this project)
    "oxlint",
    "oxlint-tsgolint",
    "knip",
    "dependency-cruiser",
  ],

  // shadcn/ui components are imported via @/components/ui/... alias
  paths: {
    "@/*": ["./src/*"],
  },

  // Types that are re-exported for external consumers (preload bridge, IPC)
  rules: {
    exports: "warn",
    files: "warn",
    dependencies: "error",
    devDependencies: "warn",
    unlisted: "error",
    unresolved: "error",
  },
};

export default config;
