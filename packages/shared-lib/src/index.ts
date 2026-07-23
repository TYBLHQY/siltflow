/**
 * @siltflow/shared-lib — Shared pure-logic library
 *
 * Portable AI, translation, FSRS, and statistics utilities used by both
 * the Electron desktop app and the Expo mobile app.
 */

// ── AI ───────────────────────────────────────────────────────────────
export {
  chatCompletion,
  type ChatMessage,
  type ChatChunk,
} from "./ai";

// ── Translation (V1) ─────────────────────────────────────────────────
export {
  translateAnnotation,
  extractArticleContext,
  type TranslateOptions,
} from "./translate";

// ── Translation (V2) ─────────────────────────────────────────────────
export {
  translateAnnotationV2,
  type TranslateV2Options,
} from "./translate-v2";

// ── Summarization ────────────────────────────────────────────────────
export {
  summarizeSelectedPages,
  type SummaryResult,
} from "./summarize";

// ── FSRS Utilities ───────────────────────────────────────────────────
export {
  // Types
  type ReviewLogData,
  // State constants
  STATE_LABEL,
  STATE_TEXT_COLOR,
  STATE_BG,
  // Grade constants
  GRADE_LABEL,
  GRADE_COLOR,
  GRADE_TEXT_COLOR,
  // Date helpers
  toDate,
  cardDueDate,
  // Formatters
  formatDue,
  formatDate,
  formatStability,
  formatInterval,
  // Card factory
  createNewCardStub,
  // Retrievability
  retrievability,
  retrievabilityLabel,
  // Review-log parsing
  parseReviewLogData,
} from "./fsrs-utils";

// ── Doc Review Metrics ───────────────────────────────────────────────
export {
  computeDocMetrics,
  sortDocMetrics,
  type DocReviewMetrics,
  type SortField,
} from "./doc-review";

// ── Statistics Computation ───────────────────────────────────────────
export {
  computeDailyReviews,
  computeCalendarHeatmap,
  computeGradeDistribution,
  computeStabilityHistogram,
  computeRetrievabilityHistogram,
  computeDifficultyHistogram,
  computeIntervalHistogram,
  computeKnowledgeGrowth,
  computeReviewForecast,
  computeForgettingCurves,
  computeRetentionTradeoff,
  computeOverviewStats,
  FORGETTING_LABELS,
  type DailyReviewCount,
  type GradeDistItem,
  type HistogramBin,
  type KnowledgePoint,
  type ForecastDay,
  type ForgettingCurvePoint,
  type RetentionTradeoffPoint,
  type OverviewStats,
} from "./stats-computation";

// ── Annotation Helpers ───────────────────────────────────────────────
export {
  getTranslation,
  getDefinitions,
  getCollocations,
  getIpa,
  getDifficulty,
  getRegister,
  getAlternatives,
  inferGranularity,
  hasDetails,
} from "./annotation-helpers";

// ── Sync Protocol ────────────────────────────────────────────────────
export {
  ENTITY_TABLES,
  type EntityTable,
  type SyncPushBody,
  type SyncPushResponse,
  type ConflictItem,
  type SyncPullBody,
  type SyncPullResponse,
  type TombstoneItem,
  type SyncAvailablePayload,
  type AuthRegisterBody,
  type AuthRegisterResponse,
  type AuthVerifyResponse,
  type SyncState,
  type SyncConfig,
} from "./sync-types";

// ── Languages ────────────────────────────────────────────────────────
export {
  LANGUAGES,
  LANGUAGES_WITH_AUTO,
  type LangOption,
} from "./languages";

// ── Providers ────────────────────────────────────────────────────────
export { BUILTIN_PROVIDERS } from "./providers";

// ── Types (re-export for convenience) ────────────────────────────────
export type {
  AIProfile,
  AITask,
  ProviderPreset,
} from "./types/ai";

export type {
  DefinitionEntry,
  ExampleEntry,
  CollocationEntry,
  AlternativeEntry,
  PronunciationInfo,
  AITranslateMetadata,
  AIAnnotationDataV1,
  AIAnnotationInputV2,
  WordMeaning,
  WordDefinitionEntry,
  WordExample,
  WordCollocation,
  WordOutputV2,
  PhraseOutputV2,
  SentenceOutputV2,
  AIAnnotationOutputV2,
  AIAnnotationDataV2,
} from "./types/annotation";
