import { create } from "zustand";

interface AppSettingsState {
  loaded: boolean;
  checkUpdateOnStartup: boolean;
  setCheckUpdateOnStartup: (v: boolean) => void;
}

const STORAGE_KEY = "app_settings";

export const useAppSettingsStore = create<AppSettingsState>()((set) => ({
  loaded: false,
  checkUpdateOnStartup: false,

  setCheckUpdateOnStartup: async (v) => {
    set({ checkUpdateOnStartup: v });
    const { configSet } = await import("../config");
    await configSet(STORAGE_KEY, JSON.stringify({ checkUpdateOnStartup: v }));
  },
}));

export async function loadAppSettingsFromConfig() {
  try {
    const { configGetAll } = await import("../config");
    const cfg = await configGetAll();
    const saved = cfg[STORAGE_KEY];
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<AppSettingsState>;
      const patch: Partial<AppSettingsState> = {};
      if (typeof parsed.checkUpdateOnStartup === "boolean")
        patch.checkUpdateOnStartup = parsed.checkUpdateOnStartup;
      useAppSettingsStore.setState({ ...patch, loaded: true });
      return;
    }
  } catch { /* ignore */ }
  useAppSettingsStore.setState({ loaded: true });
}
