import type { ProviderName } from "./types";

export interface AppSettings {
  defaultQuestionCount: number;
  defaultProviders: ProviderName[];
}

const STORAGE_KEY = "geo.settings.v1";

const DEFAULTS: AppSettings = {
  defaultQuestionCount: 25,
  defaultProviders: ["openai", "gemini", "anthropic"],
};

/**
 * Real, functioning local preferences (not a no-op settings screen): these values
 * are read by the Start Scan flow to prefill question count / provider selection.
 * There is no backend-persisted "settings" concept, so this deliberately stays
 * client-local rather than faking a server-side settings API.
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      defaultQuestionCount: parsed.defaultQuestionCount ?? DEFAULTS.defaultQuestionCount,
      defaultProviders: parsed.defaultProviders && parsed.defaultProviders.length > 0 ? parsed.defaultProviders : DEFAULTS.defaultProviders,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettings(): AppSettings {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULTS;
}

export const DEFAULT_SETTINGS = DEFAULTS;
