/**
 * Shared AI type definitions for Siltflow.
 *
 * These types are used by both the desktop (Electron) and mobile (Expo)
 * apps for AI provider configuration and translation tasks.
 */

/** The AI task types. */
export type AITask = "summarize" | "translate-input" | "translate-output";

/** A provider profile — an instance of a provider with user-specified config. */
export interface AIProfile {
  id: string;
  /** User-given name (defaults to provider label on create) */
  name: string;
  /** Provider preset key, or "custom" for user-defined */
  providerKey: string;
  /** API base URL */
  baseUrl: string;
  /** API key */
  apiKey: string;
  /** Model name */
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

/** Built-in provider preset. */
export interface ProviderPreset {
  key: string;
  label: string;
  baseUrl: string;
  /** Suggested default model — user can override */
  defaultModel: string;
  /** Whether a user can create this (vs built-in-placeholder) */
  editable?: boolean;
}
