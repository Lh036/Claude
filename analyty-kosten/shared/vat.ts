/**
 * BTW-berekening — puur rekenkundig, geen AI, geen afrondingsverrassingen.
 *
 * Alle bedragen zijn hele centen (integers). Er wordt nergens met kommagetallen
 * gerekend, dus 0,1 + 0,2-achtige floating-point fouten kunnen niet optreden.
 *
 * Formules (afronding: half naar boven, op hele centen — gangbaar voor de
 * Nederlandse BTW-aangifte):
 *
 *   Bedrag is EXCLUSIEF BTW:
 *     btw   = afronden(excl × tarief / 100)
 *     incl  = excl + btw
 *
 *   Bedrag is INCLUSIEF BTW:
 *     btw   = afronden(incl × tarief / (100 + tarief))
 *     excl  = incl − btw
 *
 * Doordat excl/incl altijd als `ander bedrag ± btw` wordt berekend, geldt
 * excl + btw = incl altijd exact.
 *
 * Dit bestand wordt door zowel de server als de browser gebruikt, zodat het
 * voorbeeld in het formulier en het opgeslagen bedrag nooit kunnen verschillen.
 */

export const VAT_RATES = [0, 9, 21] as const;
export type VatRate = (typeof VAT_RATES)[number];

export type AmountBasis = "excl" | "incl";

export interface VatBreakdown {
  rate: VatRate;
  exclCents: number;
  vatCents: number;
  inclCents: number;
}

export function isVatRate(value: unknown): value is VatRate {
  return typeof value === "number" && (VAT_RATES as readonly number[]).includes(value);
}

/** numerator / denominator, half naar boven afgerond — uitsluitend integer-rekenwerk. */
function divRoundHalfUp(numerator: number, denominator: number): number {
  const remainder = numerator % denominator;
  const quotient = (numerator - remainder) / denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

export function calculateVat(amountCents: number, rate: VatRate, basis: AmountBasis): VatBreakdown {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new RangeError("Bedrag moet een positief geheel aantal centen zijn");
  }
  if (!isVatRate(rate)) {
    throw new RangeError(`Ongeldig BTW-tarief: ${String(rate)}`);
  }
  // Grootste tussenwaarde is bedrag × 100; ruim binnen Number.MAX_SAFE_INTEGER
  // voor elk realistisch bedrag (tot ~90 biljoen euro).
  if (basis === "excl") {
    const vatCents = divRoundHalfUp(amountCents * rate, 100);
    return { rate, exclCents: amountCents, vatCents, inclCents: amountCents + vatCents };
  }
  const vatCents = divRoundHalfUp(amountCents * rate, 100 + rate);
  return { rate, exclCents: amountCents - vatCents, vatCents, inclCents: amountCents };
}

/**
 * Leest een door de gebruiker getypt bedrag als centen. Accepteert Nederlandse
 * en Engelse notatie: "12", "12,5", "12,50", "1.234,56", "1,234.56", "€ 9,99".
 * Geeft null terug bij alles wat niet eenduidig een bedrag is.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/€|\s/g, "");
  if (cleaned === "") return null;

  let whole: string;
  let fraction = "";

  let match = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(cleaned); // 1.234,56
  if (match) {
    whole = match[1]!.replace(/\./g, "");
    fraction = match[2] ?? "";
  } else if ((match = /^(\d{1,3}(?:,\d{3})+)\.(\d{1,2})$/.exec(cleaned))) {
    // 1,234.56 — alleen mét decimale punt; "12,345" is dubbelzinnig en wordt geweigerd.
    whole = match[1]!.replace(/,/g, "");
    fraction = match[2]!;
  } else if ((match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned))) {
    // 1234,56 of 1234.56
    whole = match[1]!;
    fraction = match[2] ?? "";
  } else {
    return null;
  }

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centen als invoerwaarde, bv. 123456 -> "1234,56" (voor bewerken in een formulier). */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
