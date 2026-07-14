/**
 * AI profile — configuration for a single AI provider instance.
 * Used across both desktop and mobile apps.
 */
export interface AIProfile {
  id: string;
  name: string;
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  active: boolean;
}
