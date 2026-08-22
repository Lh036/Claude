import "dotenv/config";

export type RuntimeMode = "test" | "production";

export interface ProviderRateLimitConfig {
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  retryLimit: number;
  timeoutMs: number;
}

export interface ProviderConfig extends ProviderRateLimitConfig {
  apiKey: string | undefined;
  model: string;
}

export interface GeoConfig {
  mode: RuntimeMode;
  dbPath: string;
  port: number;
  defaultQuestionCount: number;
  logLevel: "DEBUG" | "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  providers: {
    openai: ProviderConfig;
    gemini: ProviderConfig;
    anthropic: ProviderConfig;
  };
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.length > 0 ? raw : fallback;
}

function rateLimitDefaults(prefix: string): ProviderRateLimitConfig {
  return {
    maxConcurrentRequests: int(`${prefix}_MAX_CONCURRENT`, 3),
    requestsPerMinute: int(`${prefix}_REQUESTS_PER_MINUTE`, 60),
    retryLimit: int(`${prefix}_RETRY_LIMIT`, 3),
    timeoutMs: int(`${prefix}_TIMEOUT_MS`, 30_000),
  };
}

export function loadConfig(): GeoConfig {
  const mode: RuntimeMode = process.env.GEO_ENV === "production" ? "production" : "test";

  return {
    mode,
    dbPath: str("GEO_DB_PATH", "./data/geo.sqlite"),
    port: int("GEO_PORT", 3000),
    defaultQuestionCount: int("GEO_DEFAULT_QUESTION_COUNT", 25),
    logLevel: (str("GEO_LOG_LEVEL", "INFO") as GeoConfig["logLevel"]) ?? "INFO",
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: str("OPENAI_MODEL", "gpt-4o-mini"),
        ...rateLimitDefaults("OPENAI"),
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: str("GEMINI_MODEL", "gemini-1.5-flash"),
        ...rateLimitDefaults("GEMINI"),
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: str("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
        ...rateLimitDefaults("ANTHROPIC"),
      },
    },
  };
}

/** Lazily-created singleton so tests can call loadConfig() fresh with different env vars. */
let cached: GeoConfig | undefined;
export function config(): GeoConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Test helper: force the cached config to be recomputed from current env vars. */
export function resetConfigCache(): void {
  cached = undefined;
}
