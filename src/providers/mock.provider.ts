import type { AIProvider } from "./types.js";
import type { ProviderName, ProviderQueryResult } from "../models/types.js";

export type MockAnswerFn = (question: string) => string;

const DEFAULT_ANSWER: MockAnswerFn = (question) =>
  [
    `Op basis van je vraag ("${question}") zijn hier een paar opties:`,
    `1. Voorbeeldbedrijf A - sterk in kwaliteit en klantenservice.`,
    `2. Voorbeeldbedrijf B - bekend om scherpe prijzen.`,
    `3. Voorbeeldbedrijf C - goede reputatie in de regio.`,
  ].join("\n");

/**
 * Deterministic, network-free provider used in development and tests (GEO_ENV=test,
 * or as an explicit fallback when a real provider has no API key configured).
 * Every ProviderQueryResult it returns must be treated as synthetic — never fed into
 * a "production" GEO report as if it were a genuine model answer.
 */
export class MockProvider implements AIProvider {
  readonly name: ProviderName = "mock";
  readonly model = "mock-1";
  private readonly answerFn: MockAnswerFn;
  private readonly simulatedLatencyMs: number;
  private readonly failureRate: number;

  constructor(options: { answerFn?: MockAnswerFn; simulatedLatencyMs?: number; failureRate?: number } = {}) {
    this.answerFn = options.answerFn ?? DEFAULT_ANSWER;
    this.simulatedLatencyMs = options.simulatedLatencyMs ?? 5;
    this.failureRate = options.failureRate ?? 0;
  }

  isConfigured(): boolean {
    return true;
  }

  async runQuery(question: string): Promise<ProviderQueryResult> {
    const start = Date.now();
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }
    const timestamp = new Date().toISOString();
    const durationMs = Date.now() - start;

    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      return {
        provider: this.name,
        model: this.model,
        question,
        answer: null,
        timestamp,
        durationMs,
        status: "failed",
        error: { kind: "provider_unavailable", message: "Simulated mock provider failure", retryable: true },
        usage: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null },
      };
    }

    const answer = this.answerFn(question);
    const inputTokens = Math.ceil(question.length / 4);
    const outputTokens = Math.ceil(answer.length / 4);

    return {
      provider: this.name,
      model: this.model,
      question,
      answer,
      timestamp,
      durationMs,
      status: "success",
      error: null,
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, estimatedCostUsd: 0 },
    };
  }
}
