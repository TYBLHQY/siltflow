export type ShortcutContext =
  | "global" // App-wide shortcuts (any screen)
  | "pdf-open" // When a PDF document is open
  | "annotations-tab" // When the Annotations tab is active in the right panel
  | "learning-mode"; // When Start Learning (StudyPanel) is active

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
  | "searchAnnotations"
  | "startLearning"
  // Learning mode
  | "revealCard"
  | "gradeAgain"
  | "gradeHard"
  | "gradeGood"
  | "gradeEasy"
  | "backFromLearning"
  | "listenCardAudio";

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
