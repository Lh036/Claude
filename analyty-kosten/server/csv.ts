import type { Category, Expense } from "../shared/types";

const RECURRENCE_LABEL: Record<Expense["recurrence"], string> = {
  none: "Eenmalig",
  monthly: "Maandelijks",
  quarterly: "Per kwartaal",
  yearly: "Jaarlijks",
};

/** 123456 -> "1234,56" (Nederlandse Excel leest dit direct als getal). */
function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  // Voorkom formule-injectie in Excel (=, +, -, @ aan het begin van tekst).
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV met puntkomma als scheidingsteken en komma als decimaalteken, plus een
 * UTF-8 BOM — zo opent het bestand meteen correct in Nederlandse Excel.
 */
export function expensesToCsv(expenses: Expense[], categories: Category[]): string {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const header = ["Datum", "Omschrijving", "Leverancier", "Categorie", "Excl. BTW", "BTW %", "BTW", "Incl. BTW", "Type", "Notities", "Bon-link"];
  const rows = expenses.map((e) => [
    e.date,
    e.description,
    e.supplier,
    e.categoryId ? (names.get(e.categoryId) ?? "") : "",
    money(e.exclCents),
    e.vatRate,
    money(e.vatCents),
    money(e.inclCents),
    RECURRENCE_LABEL[e.recurrence],
    e.notes,
    e.receiptUrl,
  ]);
  const total = expenses.reduce((acc, e) => ({ excl: acc.excl + e.exclCents, vat: acc.vat + e.vatCents, incl: acc.incl + e.inclCents }), {
    excl: 0,
    vat: 0,
    incl: 0,
  });
  rows.push(["Totaal", "", "", "", money(total.excl), "", money(total.vat), money(total.incl), "", "", ""]);
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
