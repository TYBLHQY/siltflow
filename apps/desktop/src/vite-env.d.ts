/// <reference types="vite/client" />

// ── Vite injected globals (vite.config.ts defines these) ──────────────
declare const __APP_VERSION__: string;

// ── Window augmentation ───────────────────────────────────────────────
declare interface Window {
  siltflow: import("./types/siltflow-api").SiltflowAPI;
}
