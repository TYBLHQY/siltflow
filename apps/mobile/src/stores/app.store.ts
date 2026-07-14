import { create } from "zustand";
import { configGetAll, configSet } from "../config";

interface AppSettingsState {
  loaded: boolean;
  checkUpdateOnStartup: boolean;
  setCheckUpdateOnStartup: (v: boolean) => void;
}

const STORAGE_KEY = "appSettings";

export const useAppSettingsStore = create<AppSettingsState>()((set) => ({
  loaded: false,
  checkUpdateOnStartup: true,

  setCheckUpdateOnStartup: (v) => {
    set({ checkUpdateOnStartup: v });
    configSet({ [STORAGE_KEY]: { checkUpdateOnStartup: v } });
  },
}));

export async function loadAppSettingsFromConfig() {
  try {
    const cfg = await configGetAll();
    const saved = cfg[STORAGE_KEY] as Partial<AppSettingsState> | undefined;
    if (saved && typeof saved === "object") {
      const patch: Partial<AppSettingsState> = {};
      if (typeof saved.checkUpdateOnStartup === "boolean")
        patch.checkUpdateOnStartup = saved.checkUpdateOnStartup;
      useAppSettingsStore.setState({ ...patch, loaded: true });
      return;
    }
  } catch {
    // ignore
  }
  useAppSettingsStore.setState({ loaded: true });
}
