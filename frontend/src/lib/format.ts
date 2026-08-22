import type { ProviderName, QuestionPriority, ScanStatus } from "./types";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "—";
  const diffMs = Date.now() - date;
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const suffix = diffMs >= 0 ? "ago" : "from now";
  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.round(abs / minute)}m ${suffix}`;
  if (abs < day) return `${Math.round(abs / hour)}h ${suffix}`;
  return `${Math.round(abs / day)}d ${suffix}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat().format(value);
}

export function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "$0.00";
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

export function formatOrdinal(position: number | null | undefined): string {
  if (position === null || position === undefined) return "—";
  const suffixes = ["th", "st", "nd", "rd"] as const;
  const mod100 = position % 100;
  const suffix = suffixes[(mod100 - 20) % 10] ?? suffixes[mod100] ?? suffixes[0];
  return `${position}${suffix}`;
}

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: "ChatGPT",
  gemini: "Gemini",
  anthropic: "Claude",
  mock: "Mock (test data)",
};

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
};

export const PRIORITY_LABELS: Record<QuestionPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

export const QUESTION_CATEGORY_LABELS: Record<string, string> = {
  recommendation: "Recommendation",
  comparison: "Comparison",
  best_of: "Best-of",
  problem_based: "Problem-based",
  local: "Local",
  industry: "Industry",
  buyer_intent: "Buyer intent",
};

export function scoreTone(score: number | null | undefined): "success" | "warning" | "danger" | "neutral" {
  if (score === null || score === undefined) return "neutral";
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
