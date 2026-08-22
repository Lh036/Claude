import { classifyThrown, errorKindForStatus, makeProviderError } from "./errors.js";
import type { ProviderError } from "../models/types.js";

export interface HttpResult {
  ok: boolean;
  status: number;
  json: unknown;
  error: ProviderError | null;
}

/**
 * Small fetch wrapper shared by all real providers: applies a hard timeout via
 * AbortController and normalizes both transport failures and non-2xx HTTP
 * responses into the same ProviderError taxonomy the rest of the system expects.
 */
export async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      if (!res.ok) {
        return { ok: false, status: res.status, json: null, error: makeProviderError(errorKindForStatus(res.status), `HTTP ${res.status}`) };
      }
      return { ok: false, status: res.status, json: null, error: makeProviderError("parsing_error", "Response was not valid JSON") };
    }

    if (!res.ok) {
      const kind = errorKindForStatus(res.status);
      const message = extractErrorMessage(json) ?? `HTTP ${res.status}`;
      return { ok: false, status: res.status, json, error: makeProviderError(kind, message) };
    }

    return { ok: true, status: res.status, json, error: null };
  } catch (err) {
    return { ok: false, status: 0, json: null, error: classifyThrown(err) };
  } finally {
    clearTimeout(timer);
  }
}

function extractErrorMessage(json: unknown): string | null {
  if (json && typeof json === "object" && "error" in json) {
    const err = (json as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
  }
  return null;
}
