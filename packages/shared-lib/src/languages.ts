/**
 * Shared language definitions for AI translation / config selects.
 */
export interface LangOption {
  value: string;
  label: string;
}

export const LANGUAGES: LangOption[] = [
  { value: "zh-CN", label: "中文 (简体)" },
  { value: "en-US", label: "English (US)" },
  { value: "ja-JP", label: "日本語" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "es-ES", label: "Español" },
  { value: "ko-KR", label: "한국어" },
  { value: "ru-RU", label: "Русский" },
];

export const LANGUAGES_WITH_AUTO: LangOption[] = [
  { value: "auto", label: "Auto" },
  ...LANGUAGES,
];
