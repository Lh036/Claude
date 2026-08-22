import type { AIProvider } from "./types.js";
import type { ProviderConfig } from "../config/index.js";
import type { ProviderQueryResult, TokenUsage } from "../models/types.js";
import { postJson } from "./httpClient.js";
import { makeProviderError } from "./errors.js";

const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
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
        error: makeProviderError("authentication", "ANTHROPIC_API_KEY is not configured"),
        usage: emptyUsage(),
      };
    }

    const result = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.cfg.apiKey ?? "", "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: question }],
      },
      this.cfg.timeoutMs,
    );

    const durationMs = Date.now() - start;

    if (!result.ok) {
      return { provider: this.name, model: this.model, question, answer: null, timestamp, durationMs, status: "failed", error: result.error, usage: emptyUsage() };
    }

    const body = result.json as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const answer = body.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? null;

    if (!answer || answer.trim().length === 0) {
      return { provider: this.name, model: this.model, question, answer: null, timestamp, durationMs, status: "failed", error: makeProviderError("empty_response", "Claude returned an empty answer"), usage: emptyUsage() };
    }

    const usage = usageFromAnthropic(body.usage);
    return { provider: this.name, model: this.model, question, answer, timestamp, durationMs, status: "success", error: null, usage };
  }
}

function emptyUsage(): TokenUsage {
  return { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null };
}

function usageFromAnthropic(usage?: { input_tokens?: number; output_tokens?: number }): TokenUsage {
  if (!usage) return emptyUsage();
  const inputTokens = usage.input_tokens ?? null;
  const outputTokens = usage.output_tokens ?? null;
  const totalTokens = inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
  const estimatedCostUsd =
    inputTokens !== null && outputTokens !== null
      ? (inputTokens / 1_000_000) * INPUT_COST_PER_M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_M
      : null;
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd };
}
