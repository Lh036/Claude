import type { AIProvider } from "./types.js";
import type { ProviderConfig } from "../config/index.js";
import type { ProviderQueryResult, TokenUsage } from "../models/types.js";
import { postJson } from "./httpClient.js";
import { makeProviderError } from "./errors.js";

// USD per 1M tokens, ballpark defaults for gpt-4o-mini-class models. Overridable via cost estimation later if needed.
const INPUT_COST_PER_M = 0.15;
const OUTPUT_COST_PER_M = 0.6;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly model: string;
  private readonly cfg: ProviderConfig;

  constructor(cfg: ProviderConfig) {
    this.cfg = cfg;
    this.model = cfg.model;
  }

  isConfigured(): boolean {
    return !!this.cfg.apiKey;
  }

  async runQuery(question: string): Promise<ProviderQueryResult> {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    if (!this.isConfigured()) {
      return {
        provider: this.name,
        model: this.model,
        question,
        answer: null,
        timestamp,
        durationMs: Date.now() - start,
        status: "failed",
        error: makeProviderError("authentication", "OPENAI_API_KEY is not configured"),
        usage: emptyUsage(),
      };
    }

    const result = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.cfg.apiKey}` },
      {
        model: this.model,
        messages: [{ role: "user", content: question }],
      },
      this.cfg.timeoutMs,
    );

    const durationMs = Date.now() - start;

    if (!result.ok) {
      return { provider: this.name, model: this.model, question, answer: null, timestamp, durationMs, status: "failed", error: result.error, usage: emptyUsage() };
    }

    const body = result.json as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const answer = body.choices?.[0]?.message?.content ?? null;

    if (!answer || answer.trim().length === 0) {
      return { provider: this.name, model: this.model, question, answer: null, timestamp, durationMs, status: "failed", error: makeProviderError("empty_response", "OpenAI returned an empty answer"), usage: emptyUsage() };
    }

    const usage = usageFromOpenAi(body.usage);
    return { provider: this.name, model: this.model, question, answer, timestamp, durationMs, status: "success", error: null, usage };
  }
}

function emptyUsage(): TokenUsage {
  return { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null };
}

function usageFromOpenAi(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }): TokenUsage {
  if (!usage) return emptyUsage();
  const inputTokens = usage.prompt_tokens ?? null;
  const outputTokens = usage.completion_tokens ?? null;
  const totalTokens = usage.total_tokens ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  const estimatedCostUsd =
    inputTokens !== null && outputTokens !== null
      ? (inputTokens / 1_000_000) * INPUT_COST_PER_M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_M
      : null;
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd };
}
