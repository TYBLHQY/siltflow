/**
 * Mobile stores barrel — all Zustand stores backed by @capacitor-community/sqlite
 * and @capacitor/preferences.
 *
 * Shared types and business logic come from @siltflow/shared.
 */

export { useDocumentStore } from "./document.store";
export type { DocumentItem } from "./document.store";

export { useFolderStore } from "./folder.store";
export type { FolderItem } from "./folder.store";

export { useAnnotationStore } from "./annotation.store";
export type { AnnotationItem, AnnotationEmbedData } from "./annotation.store";

export { useAIStore, BUILTIN_PROVIDERS } from "./ai.store";
export type { AIProfile, ProviderPreset } from "./ai.store";

export { useSummaryStore } from "./summary.store";
export type { DocSummary } from "./summary.store";

export { useFSRSStore, getFSRSEngine, initAnnotationCard, reviewAnnotation, getNextReview, loadFSRSParams } from "./fsrs.store";
export { useReviewLogStore } from "./review-log.store";

export { useStatsStore } from "./stats.store";

export { useThemeStore } from "./theme.store";
export type { ThemeFlavor, ThemeMode, ThemeConfig } from "./theme.store";

export { useStyleStore, buildFontStack } from "./style.store";
export type { ParagraphStyle } from "./style.store";

export { useAppSettingsStore } from "./app.store";

export { useToastStore } from "./toast.store";

export { useTTSStore, loadTTSConfigFromConfig } from "./tts.store";
export type { TTSConfig, TTSProvider } from "./tts.store";

// ---------------------------------------------------------------------------
// Boot: call once to hydrate all stores from persistent storage
// ---------------------------------------------------------------------------

export async function bootStores() {
  const { loadFromConfig } = await import("./ai.store");
  const { loadFSRSParams } = await import("./fsrs.store");
  const { loadSummariesFromDb } = await import("./summary.store");
  const { loadStyleFromConfig } = await import("./style.store");
  const { loadThemeFromConfig } = await import("./theme.store");
  const { loadAppSettingsFromConfig } = await import("./app.store");
  const { loadTTSConfigFromConfig } = await import("./tts.store");

  await Promise.all([
    loadFromConfig(),
    loadFSRSParams(),
    loadSummariesFromDb(),
    loadStyleFromConfig(),
    loadThemeFromConfig(),
    loadAppSettingsFromConfig(),
    loadTTSConfigFromConfig(),
  ]);
}
