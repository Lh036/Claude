import { describe, expect, it } from "vitest";
import { runAiQueries } from "../src/queue/aiQueryQueue.js";
import { retryWithBackoff } from "../src/queue/retry.js";
import { MockProvider } from "../src/providers/mock.provider.js";
import { createBusiness } from "../src/db/business.repository.js";
import { createScan } from "../src/db/scan.repository.js";
import { saveQuestions } from "../src/db/question.repository.js";
import type { AIProvider } from "../src/providers/types.js";
import type { GeneratedQuestion, ProviderQueryResult } from "../src/models/types.js";

/** Creates a real business + scan + question rows so responses can satisfy foreign keys. */
function setupScanWithQuestions(count: number): { scanId: string; questions: GeneratedQuestion[] } {
  const business = createBusiness({ companyName: "Test Business", industry: "test" });
  const scan = createScan(business.id, { questionCount: count, providers: ["mock"] });
  const questions: GeneratedQuestion[] = Array.from({ length: count }, (_, i) => ({
    id: `q_${scan.id}_${i}`,
    scanId: scan.id,
    question: `Vraag ${i}?`,
    category: "recommendation",
    intent: "commercial",
    location: "Amsterdam",
    industry: "marketing",
    priority: "high",
    reason: "test",
    valid: true,
  }));
  saveQuestions(questions);
  return { scanId: scan.id, questions };
}

/** A provider stub that fails a fixed number of times before succeeding, for retry tests. */
class FlakyProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly model = "flaky-model";
  private calls = 0;
  constructor(private readonly failuresBeforeSuccess: number) {}

  isConfigured(): boolean {
    return true;
  }

  async runQuery(question: string): Promise<ProviderQueryResult> {
    this.calls++;
    if (this.calls <= this.failuresBeforeSuccess) {
      return {
        provider: this.name,
        model: this.model,
        question,
        answer: null,
        timestamp: new Date().toISOString(),
        durationMs: 1,
        status: "failed",
        error: { kind: "timeout", message: "simulated timeout", retryable: true },
        usage: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null },
      };
    }
    return {
      provider: this.name,
      model: this.model,
      question,
      answer: "Prima antwoord.",
      timestamp: new Date().toISOString(),
      durationMs: 1,
      status: "success",
      error: null,
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10, estimatedCostUsd: 0 },
    };
  }
}

class AlwaysFailsProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly model = "broken-model";
  isConfigured(): boolean {
    return true;
  }
  async runQuery(question: string): Promise<ProviderQueryResult> {
    return {
      provider: this.name,
      model: this.model,
      question,
      answer: null,
      timestamp: new Date().toISOString(),
      durationMs: 1,
      status: "failed",
      error: { kind: "authentication", message: "bad credentials", retryable: false },
      usage: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null },
    };
  }
}

describe("retryWithBackoff", () => {
  it("retries a transient failure until it succeeds", async () => {
    const provider = new FlakyProvider(2);
    const outcome = await retryWithBackoff<ProviderQueryResult>(
      () => provider.runQuery("test"),
      (r) => r.status === "success",
      { retryLimit: 5, baseDelayMs: 1, isRetryable: (r) => r.status === "failed" && r.error?.retryable === true },
    );
    expect(outcome.result.status).toBe("success");
    expect(outcome.attempts).toBe(3);
  });

  it("does not retry a permanent (non-retryable) error", async () => {
    const provider = new AlwaysFailsProvider();
    const outcome = await retryWithBackoff<ProviderQueryResult>(
      () => provider.runQuery("test"),
      (r) => r.status === "success",
      { retryLimit: 5, baseDelayMs: 1, isRetryable: (r) => r.status === "failed" && r.error?.retryable === true },
    );
    expect(outcome.result.status).toBe("failed");
    expect(outcome.attempts).toBe(1);
  });
});

describe("aiQueryQueue", () => {
  it("continues the batch when one provider fails permanently, and records the error", async () => {
    const { scanId, questions } = setupScanWithQuestions(2);
    const good = new MockProvider();
    const bad = new AlwaysFailsProvider();

    const { responses, errors } = await runAiQueries(scanId, questions, [good, bad]);

    expect(responses).toHaveLength(4); // 2 questions x 2 providers
    const goodResponses = responses.filter((r) => r.provider === "mock");
    const badResponses = responses.filter((r) => r.provider === "gemini");
    expect(goodResponses.every((r) => r.status === "success")).toBe(true);
    expect(badResponses.every((r) => r.status === "failed")).toBe(true);
    expect(errors.length).toBe(2); // one failure per question for the bad provider
    expect(errors[0]?.provider).toBe("gemini");
  });

  it("recovers a flaky provider through retries within the batch", async () => {
    const { scanId, questions } = setupScanWithQuestions(1);
    const flaky = new FlakyProvider(1);
    const { responses, errors } = await runAiQueries(scanId, questions, [flaky]);
    expect(responses).toHaveLength(1);
    expect(responses[0]?.status).toBe("success");
    expect(responses[0]?.attempt).toBe(2);
    expect(errors).toHaveLength(0);
  });
});
