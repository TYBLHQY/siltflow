import { create } from "zustand"

export interface ParagraphStyle {
  /** CSS font-family (e.g. "Inter", "Georgia, serif", "system-ui, sans-serif"). */
  fontFamily: string
  /** Font size in px. */
  fontSize: number
}

interface StyleState {
  style: ParagraphStyle
  setFontFamily: (family: string) => void
  setFontSize: (size: number) => void
  reset: () => void
}

const STORAGE_KEY = "paragraphStyle"
const DEFAULT_STYLE: ParagraphStyle = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 13,
}

function persist(style: ParagraphStyle) {
  window.siltflow.vaultConfigSet({ [STORAGE_KEY]: style })
}

export const useStyleStore = create<StyleState>((set) => ({
  style: { ...DEFAULT_STYLE },

  setFontFamily: (fontFamily) =>
    set((s) => {
      const next = { ...s.style, fontFamily }
      persist(next)
      return { style: next }
    }),

  setFontSize: (fontSize) =>
    set((s) => {
      const next = { ...s.style, fontSize }
      persist(next)
      return { style: next }
    }),

  reset: () => {
    persist(DEFAULT_STYLE)
    set({ style: { ...DEFAULT_STYLE } })
  },
}))

/** Call once on app boot to restore style from vault. */
export async function loadStyleFromVault() {
  try {
    const cfg = await window.siltflow.vaultConfigGet()
    const saved = (cfg as Record<string, unknown>)[STORAGE_KEY]
    if (saved && typeof saved === "object") {
      const s = saved as Record<string, unknown>
      useStyleStore.setState({
        style: {
          fontFamily:
            (s.fontFamily as string) ?? DEFAULT_STYLE.fontFamily,
          fontSize:
            (s.fontSize as number) ?? DEFAULT_STYLE.fontSize,
        },
      })
    }
  } catch { /* ignore */ }
}
