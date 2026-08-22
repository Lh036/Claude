export interface RetryOptions<T> {
  retryLimit: number; // total attempts = retryLimit
  baseDelayMs?: number;
  isRetryable: (result: T) => boolean;
}

export interface RetryOutcome<T> {
  result: T;
  attempts: number;
}

/**
 * Runs `fn` up to `retryLimit` times with exponential backoff, but only retries
 * when `isRetryable` says the failure is transient (timeouts, rate limits, 5xx).
 * Permanent errors (bad credentials, malformed request) fail fast on attempt 1.
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  shouldStop: (result: T) => boolean,
  options: RetryOptions<T>,
): Promise<RetryOutcome<T>> {
  const baseDelay = options.baseDelayMs ?? 500;
  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= options.retryLimit; attempt++) {
    lastResult = await fn(attempt);
    if (shouldStop(lastResult)) {
      return { result: lastResult, attempts: attempt };
    }
    if (!options.isRetryable(lastResult) || attempt === options.retryLimit) {
      return { result: lastResult, attempts: attempt };
    }
    const delay = baseDelay * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Unreachable when retryLimit >= 1, but keeps TypeScript satisfied.
  return { result: lastResult as T, attempts: options.retryLimit };
}
