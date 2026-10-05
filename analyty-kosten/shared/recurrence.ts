/**
 * Terugkerende kosten: termijnen, maandlasten en vervaldata. Datums zijn altijd
 * "YYYY-MM-DD"-strings (kalenderdagen, geen tijdzones).
 */

export const RECURRENCES = ["none", "monthly", "quarterly", "yearly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_MONTHS: Record<Exclude<Recurrence, "none">, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y!, m!, d!];
}

/**
 * Telt maanden op bij een datum. Bestaat de dag niet in de doelmaand, dan wordt
 * het de laatste dag van die maand (31 jan + 1 maand = 28/29 feb).
 * `anchorDay` is de oorspronkelijke dag, zodat 31 jan -> 28 feb -> 31 mrt blijft.
 */
export function addMonths(date: string, months: number, anchorDay?: number): string {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** De eerstvolgende termijn na de laatst geboekte datum. */
export function nextDueDate(startDate: string, recurrence: Exclude<Recurrence, "none">, lastBookedDate: string): string {
  const step = RECURRENCE_MONTHS[recurrence];
  const anchorDay = parts(startDate)[2];
  let n = 1;
  let candidate = addMonths(startDate, step, anchorDay);
  while (candidate <= lastBookedDate) {
    n += 1;
    candidate = addMonths(startDate, step * n, anchorDay);
  }
  return candidate;
}

/**
 * Maandlast van een set terugkerende kosten, in centen. Eerst alles naar een
 * jaarbedrag (exact, integers), pas daarna één keer delen door 12 en afronden.
 */
export function monthlyBurnCents(items: { recurrence: Recurrence; exclCents: number }[]): number {
  const yearly = yearlyRecurringCents(items);
  return Math.round(yearly / 12);
}

export function yearlyRecurringCents(items: { recurrence: Recurrence; exclCents: number }[]): number {
  let total = 0;
  for (const item of items) {
    if (item.recurrence === "none") continue;
    total += item.exclCents * (12 / RECURRENCE_MONTHS[item.recurrence]);
  }
  return total;
}
