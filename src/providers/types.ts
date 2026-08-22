import type { ProviderName, ProviderQueryResult } from "../models/types.js";

export interface AIProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** Whether this provider is actually usable right now (e.g. has an API key configured). */
  isConfigured(): boolean;
  /** Uniform entry point: every provider implementation returns the same result shape. */
  runQuery(question: string): Promise<ProviderQueryResult>;
}
