import type { ProviderError, ProviderErrorKind } from "../models/types.js";

const RETRYABLE: Record<ProviderErrorKind, boolean> = {
  timeout: true,
  rate_limit: true,
  authentication: false,
  invalid_response: false,
  empty_response: true,
  provider_unavailable: true,
  parsing_error: false,
  network_error: true,
  unknown: false,
};

export function makeProviderError(kind: ProviderErrorKind, message: string): ProviderError {
  return { kind, message, retryable: RETRYABLE[kind] };
}

/** Maps an HTTP status code from a provider API to a ProviderErrorKind. */
export function errorKindForStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "provider_unavailable";
  if (status >= 400) return "invalid_response";
  return "unknown";
}

export function classifyThrown(err: unknown): ProviderError {
  if (err instanceof DOMException && err.name === "AbortError") {
    return makeProviderError("timeout", "Request timed out");
  }
  if (err instanceof Error) {
    if (/network|fetch failed|ECONNREFUSED|ENOTFOUND/i.test(err.message)) {
      return makeProviderError("network_error", err.message);
    }
    return makeProviderError("unknown", err.message);
  }
  return makeProviderError("unknown", String(err));
}
