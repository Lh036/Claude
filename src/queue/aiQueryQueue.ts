import { RateLimitedQueue } from "./rateLimitedQueue.js";
import { retryWithBackoff } from "./retry.js";
import { config, type ProviderRateLimitConfig } from "../config/index.js";
import type { AIProvider } from "../providers/types.js";
import type { AIResponse, GeneratedQuestion, ProviderQueryResult, ScanError } from "../models/types.js";
import { generateId } from "../utils/id.js";
import { saveResponse } from "../db/response.repository.js";
import { logger } from "../logging/logger.js";

const MOCK_QUEUE_CONFIG: ProviderRateLimitConfig = {
  maxConcurrentRequests: 5,
  requestsPerMinute: 0,
  retryLimit: 1,
  timeoutMs: 5_000,
};

function rateLimitConfigFor(provider: AIProvider): ProviderRateLimitConfig {
  const cfg = config();
  switch (provider.name) {
    case "openai":
      return cfg.providers.openai;
    case "gemini":
      return cfg.providers.gemini;
    case "anthropic":
      return cfg.providers.anthropic;
    default:
      return MOCK_QUEUE_CONFIG;
  }
}

export interface AiQueryQueueResult {
  responses: AIResponse[];
  errors: ScanError[];
}

/**
 * Runs every (question, provider) pair through the AI Query Engine. Each provider
 * gets its own concurrency/rate-limit queue (section 22) so one provider's limits
 * never starve another. Transient failures are retried with exponential backoff
 * (section 21); a permanently-failed pair is recorded as a ScanError and stored as
 * a failed AIResponse instead of aborting the rest of the scan (section 19-20).
 */
export async function runAiQueries(
  scanId: string,
  questions: GeneratedQuestion[],
  providers: AIProvider[],
): Promise<AiQueryQueueResult> {
  const queues = new Map<string, RateLimitedQueue>();
  for (const provider of providers) {
    const rl = rateLimitConfigFor(provider);
    queues.set(provider.name, new RateLimitedQueue(rl.maxConcurrentRequests, rl.requestsPerMinute));
  }

  const errors: ScanError[] = [];
  const responses: AIResponse[] = [];

  const tasks: Array<Promise<void>> = [];
  for (const question of questions) {
    for (const provider of providers) {
      const queue = queues.get(provider.name) as RateLimitedQueue;
      const rl = rateLimitConfigFor(provider);

      tasks.push(
        queue.schedule(async () => {
          logger.debug("ai_request_started", `Querying ${provider.name} for question`, {
            scanId,
            questionId: question.id,
            provider: provider.name,
          });

          let outcome;
          try {
            outcome = await retryWithBackoff<ProviderQueryResult>(
              () => provider.runQuery(question.question),
              (result) => result.status === "success",
              { retryLimit: Math.max(1, rl.retryLimit), isRetryable: (result) => result.status === "failed" && result.error?.retryable === true },
            );
          } catch (err) {
            // Defensive: a provider implementation must not throw, but if it does, one
            // request must never take down the whole scan.
            const message = err instanceof Error ? err.message : String(err);
            outcome = {
              attempts: 1,
              result: {
                provider: provider.name,
                model: provider.model,
                question: question.question,
                answer: null,
                timestamp: new Date().toISOString(),
                durationMs: 0,
                status: "failed" as const,
                error: { kind: "unknown" as const, message, retryable: false },
                usage: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null },
              },
            };
          }

          const response: AIResponse = {
            id: generateId("resp"),
            scanId,
            questionId: question.id,
            provider: outcome.result.provider,
            model: outcome.result.model,
            question: outcome.result.question,
            answer: outcome.result.answer,
            timestamp: outcome.result.timestamp,
            durationMs: outcome.result.durationMs,
            status: outcome.result.status,
            error: outcome.result.error,
            usage: outcome.result.usage,
            attempt: outcome.attempts,
          };

          saveResponse(response);
          responses.push(response);

          if (response.status === "success") {
            logger.success("ai_request_completed", `${provider.name} answered question in ${response.durationMs}ms`, {
              scanId,
              questionId: question.id,
              provider: provider.name,
            });
          } else {
            const error: ScanError = {
              stage: "ai_querying",
              questionId: question.id,
              provider: provider.name,
              message: response.error?.message ?? "AI request failed",
              timestamp: new Date().toISOString(),
            };
            errors.push(error);
            logger.error("ai_request_failed", `${provider.name} failed after ${outcome.attempts} attempt(s): ${error.message}`, {
              scanId,
              questionId: question.id,
              provider: provider.name,
            });
          }
        }),
      );
    }
  }

  await Promise.all(tasks);
  return { responses, errors };
}
