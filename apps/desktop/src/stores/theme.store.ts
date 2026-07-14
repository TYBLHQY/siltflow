import { create } from "zustand";

export type ThemeFlavor = "latte" | "frappe" | "macchiato" | "mocha";
export type ThemeMode = "auto" | "light" | "dark";

export interface ThemeConfig {
  lightTheme: ThemeFlavor;
  darkTheme: ThemeFlavor;
  themeMode: ThemeMode;
  pdfDarkInvert: boolean;
}

interface ThemeStoreState {
  config: ThemeConfig;
  setLightTheme: (flavor: ThemeFlavor) => void;
  setDarkTheme: (flavor: ThemeFlavor) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPdfDarkInvert: (v: boolean) => void;
  resolveTheme: () => { flavor: ThemeFlavor; isDark: boolean };
}

const STORAGE_KEY = "themeConfig";

const DEFAULT_CONFIG: ThemeConfig = {
  lightTheme: "latte",
  darkTheme: "mocha",
  themeMode: "auto",
  pdfDarkInvert: true,
};

function persist(config: ThemeConfig) {
  window.siltflow.vaultConfigSet({ [STORAGE_KEY]: config });
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  config: { ...DEFAULT_CONFIG },

  setLightTheme: (lightTheme) =>
    set((s) => {
      const next = { ...s.config, lightTheme };
      persist(next);
      return { config: next };
    }),

  setDarkTheme: (darkTheme) =>
    set((s) => {
      const next = { ...s.config, darkTheme };
      persist(next);
      return { config: next };
    }),

  setThemeMode: (themeMode) =>
    set((s) => {
      const next = { ...s.config, themeMode };
      persist(next);
      return { config: next };
    }),

  setPdfDarkInvert: (pdfDarkInvert) =>
    set((s) => {
      const next = { ...s.config, pdfDarkInvert };
      persist(next);
      return { config: next };
    }),

  resolveTheme: () => {
    const { lightTheme, darkTheme, themeMode } = get().config;
    if (themeMode === "light") {
      return { flavor: lightTheme as ThemeFlavor, isDark: false };
    }
    if (themeMode === "dark") {
      return { flavor: darkTheme, isDark: true };
    }
    // auto: follow OS
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    if (prefersDark) {
      return { flavor: darkTheme, isDark: true };
    }
    return { flavor: lightTheme as ThemeFlavor, isDark: false };
  },
}));

/** Call once on app boot to restore theme config from vault. */
export async function loadThemeFromVault() {
  try {
    const cfg = await window.siltflow.vaultConfigGet();
    const saved = (cfg as Record<string, unknown>)[STORAGE_KEY] as
      Partial<ThemeConfig> | undefined;
    if (saved && typeof saved === "object") {
      useThemeStore.setState({
        config: { ...DEFAULT_CONFIG, ...saved },
      });
    }
  } catch {
    /* ignore */
  }
}
