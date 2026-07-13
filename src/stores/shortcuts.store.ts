/**
 * Keyboard shortcuts configuration store.
 *
 * Stores default shortcuts and allows user customization.
 * Persisted to vault config under the "shortcuts" key.
 */

import { create } from "zustand";

// ── Context names ───────────────────────────────────────────────────────────

export type ShortcutContext =
  | "global" // App-wide shortcuts (any screen)
  | "pdf-open" // When a PDF document is open
  | "annotations-tab" // When the Annotations tab is active in the right panel
  | "learning-mode"; // When Start Learning (StudyPanel) is active

// ── Action IDs ──────────────────────────────────────────────────────────────

export type ShortcutActionId =
  // Global
  | "toggleDocsTab"
  | "toggleReviewTab"
  | "toggleOutlinesTab"
  | "toggleAnnotationsTab"
  | "toggleSummaryTab"
  | "toggleStats"
  | "toggleLeftPanel"
  | "toggleRightPanel"
  | "openSettings"
  | "toggleQuickAdd"
  // PDF open
  | "toggleFitWidth"
  // Annotations tab
  | "startLearning"
  // Learning mode
  | "revealCard"
  | "gradeAgain"
  | "gradeHard"
  | "gradeGood"
  | "gradeEasy"
  | "backFromLearning"
  | "listenCardAudio";

// ── Shortcut entry ──────────────────────────────────────────────────────────

export interface ShortcutEntry {
  /** Unique action identifier */
  actionId: ShortcutActionId;
  /** Human-readable description shown in settings UI */
  label: string;
  /** Which context this shortcut is active in */
  context: ShortcutContext;
  /** Default key combo string (e.g. "alt+1") */
  defaultKeys: string;
  /** Current user-configured keys (falls back to defaultKeys if empty) */
  keys: string;
  /** Whether this shortcut is editable by the user */
  locked?: boolean;
}

// ── Default shortcuts ───────────────────────────────────────────────────────

export const DEFAULT_SHORTCUTS: ShortcutEntry[] = [
  // Global — tab navigation
  {
    actionId: "toggleDocsTab",
    label: "Docs tab",
    context: "global",
    defaultKeys: "alt+1",
    keys: "alt+1",
  },
  {
    actionId: "toggleReviewTab",
    label: "Review tab",
    context: "global",
    defaultKeys: "alt+2",
    keys: "alt+2",
  },
  {
    actionId: "toggleOutlinesTab",
    label: "Outlines tab",
    context: "global",
    defaultKeys: "alt+3",
    keys: "alt+3",
  },
  {
    actionId: "toggleAnnotationsTab",
    label: "Annotations tab",
    context: "global",
    defaultKeys: "alt+a",
    keys: "alt+a",
  },
  {
    actionId: "toggleSummaryTab",
    label: "Summary tab",
    context: "global",
    defaultKeys: "alt+s",
    keys: "alt+s",
  },
  {
    actionId: "toggleStats",
    label: "Toggle statistics dashboard",
    context: "global",
    defaultKeys: "ctrl+d",
    keys: "ctrl+d",
  },
  // Global — panels
  {
    actionId: "toggleLeftPanel",
    label: "Toggle left panel",
    context: "global",
    defaultKeys: "alt+[",
    keys: "alt+[",
  },
  {
    actionId: "toggleRightPanel",
    label: "Toggle right panel",
    context: "global",
    defaultKeys: "alt+]",
    keys: "alt+]",
  },
  // Global — settings
  {
    actionId: "openSettings",
    label: "Open settings",
    context: "global",
    defaultKeys: "ctrl+,",
    keys: "ctrl+,",
  },
  {
    actionId: "toggleQuickAdd",
    label: "Toggle quick add",
    context: "global",
    defaultKeys: "ctrl+i",
    keys: "ctrl+i",
  },
  // PDF open
  {
    actionId: "toggleFitWidth",
    label: "Toggle fit width",
    context: "pdf-open",
    defaultKeys: "ctrl+e",
    keys: "ctrl+e",
  },
  // Annotations tab
  {
    actionId: "startLearning",
    label: "Start Learning",
    context: "pdf-open",
    defaultKeys: "ctrl+s",
    keys: "ctrl+s",
  },
  // Learning mode
  {
    actionId: "revealCard",
    label: "Reveal / flip card",
    context: "learning-mode",
    defaultKeys: "space",
    keys: "space",
  },
  {
    actionId: "gradeAgain",
    label: "Again (grade 1)",
    context: "learning-mode",
    defaultKeys: "num1",
    keys: "num1",
  },
  {
    actionId: "gradeHard",
    label: "Hard (grade 2)",
    context: "learning-mode",
    defaultKeys: "num2",
    keys: "num2",
  },
  {
    actionId: "gradeGood",
    label: "Good (grade 3)",
    context: "learning-mode",
    defaultKeys: "num3",
    keys: "num3",
  },
  {
    actionId: "gradeEasy",
    label: "Easy (grade 4)",
    context: "learning-mode",
    defaultKeys: "num4",
    keys: "num4",
  },
  {
    actionId: "listenCardAudio",
    label: "Listen / stop audio",
    context: "learning-mode",
    defaultKeys: "alt+l",
    keys: "alt+l",
  },
];

const VAULT_KEY = "shortcuts";

// ── Store ───────────────────────────────────────────────────────────────────

interface ShortcutsStoreState {
  /** Whether initial load from vault is done */
  loaded: boolean;
  /** All shortcut entries */
  shortcuts: ShortcutEntry[];
  /** Replace a single shortcut's keys */
  setShortcutKeys: (actionId: ShortcutActionId, keys: string) => void;
  /** Reset all shortcuts to their defaults */
  resetAllShortcuts: () => void;
  /** Reset a single shortcut to default */
  resetShortcut: (actionId: ShortcutActionId) => void;
  /** Get the effective keys string for an action (user or default fallback) */
  getKeys: (actionId: ShortcutActionId) => string;
}

export const useShortcutsStore = create<ShortcutsStoreState>()((set, get) => ({
  loaded: false,
  shortcuts: DEFAULT_SHORTCUTS.map((s) => ({ ...s })),

  setShortcutKeys: (actionId: string, keys: string) =>
    set((s) => {
      const next = s.shortcuts.map((sc) =>
        sc.actionId === actionId ? { ...sc, keys } : sc,
      );
      persistShortcuts(next);
      return { shortcuts: next };
    }),

  resetAllShortcuts: () => {
    const next = DEFAULT_SHORTCUTS.map((s) => ({ ...s }));
    persistShortcuts(next);
    set({ shortcuts: next });
  },

  resetShortcut: (actionId) => {
    set((s) => {
      const next = s.shortcuts.map((sc) =>
        sc.actionId === actionId ? { ...sc, keys: sc.defaultKeys } : sc,
      );
      persistShortcuts(next);
      return { shortcuts: next };
    });
  },

  getKeys: (actionId) => {
    const entry = get().shortcuts.find((s) => s.actionId === actionId);
    return entry?.keys ?? entry?.defaultKeys ?? "";
  },
}));

// ── Vault persistence ───────────────────────────────────────────────────────

function persistShortcuts(shortcuts: ShortcutEntry[]) {
  // Only persist the non-default keys to save space
  const custom: Record<string, string> = {};
  for (const s of shortcuts) {
    if (s.keys !== s.defaultKeys) {
      custom[s.actionId] = s.keys;
    }
  }
  window.siltflow.vaultConfigSet({ [VAULT_KEY]: custom });
}

/** Call once on app boot to restore shortcuts from vault. */
export async function loadShortcutsFromVault() {
  try {
    const cfg = await window.siltflow.vaultConfigGet();
    const saved = (cfg as Record<string, unknown>)[VAULT_KEY] as
      Record<string, string> | undefined;
    if (saved && typeof saved === "object") {
      const next = DEFAULT_SHORTCUTS.map((s) => ({
        ...s,
        keys: saved[s.actionId] ?? s.keys,
      }));
      useShortcutsStore.setState({ shortcuts: next, loaded: true });
      return;
    }
  } catch {
    /* ignore */
  }
  useShortcutsStore.setState({ loaded: true });
}
