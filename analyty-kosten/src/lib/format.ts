import type { Recurrence } from "@shared/recurrence";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const euroWhole = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Centen -> "€ 1.234,56". Alleen voor weergave; rekenen gebeurt altijd in centen. */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

export function formatEuroShort(cents: number): string {
  return euroWhole.format(Math.round(cents / 100));
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export const MONTHS_LONG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Eenmalig",
  monthly: "Maandelijks",
  quarterly: "Per kwartaal",
  yearly: "Jaarlijks",
};

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
