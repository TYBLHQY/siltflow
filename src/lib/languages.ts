/**
 * Shared language definitions for AI translation / config selects.
 */
export interface LangOption {
  value: string;
  label: string;
}

export const LANGUAGES: LangOption[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
];

export const LANGUAGES_WITH_AUTO: LangOption[] = [
  { value: "auto", label: "Auto" },
  ...LANGUAGES,
];
