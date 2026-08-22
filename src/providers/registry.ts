import { config } from "../config/index.js";
import type { AIProvider } from "./types.js";
import type { ProviderName } from "../models/types.js";
import { OpenAIProvider } from "./openai.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { MockProvider } from "./mock.provider.js";
import { logger } from "../logging/logger.js";

const REAL_PROVIDER_NAMES: ProviderName[] = ["openai", "gemini", "anthropic"];

/**
 * Builds the set of AIProvider instances to use for a scan. In "test" mode every
 * provider is backed by MockProvider (no network, no cost, fully reproducible).
 * In "production" mode real providers are used, but a provider without a configured
 * API key still falls back to Mock rather than silently failing the whole scan —
 * the resulting responses/analysis are tagged as coming from the "mock" provider
 * so they are never confused with genuine AI output (see rule: no fake data in the
 * real analysis).
 */
export function buildProviders(requested: ProviderName[]): AIProvider[] {
  const mode = config().mode;
  const providers: AIProvider[] = [];

  for (const name of requested) {
    if (name === "mock" || mode === "test") {
      providers.push(new MockProvider());
      continue;
    }

    const real = createRealProvider(name);
    if (real.isConfigured()) {
      providers.push(real);
    } else {
      logger.warning(
        "provider_not_configured",
        `Provider "${name}" has no API key configured in production mode; falling back to MockProvider for this scan`,
        undefined,
        { provider: name },
      );
      providers.push(new MockProvider());
    }
  }

  return providers;
}

function createRealProvider(name: ProviderName): AIProvider {
  const cfg = config();
  switch (name) {
    case "openai":
      return new OpenAIProvider(cfg.providers.openai);
    case "gemini":
      return new GeminiProvider(cfg.providers.gemini);
    case "anthropic":
      return new AnthropicProvider(cfg.providers.anthropic);
    default:
      return new MockProvider();
  }
}

export function allSupportedProviderNames(): ProviderName[] {
  return REAL_PROVIDER_NAMES;
}
