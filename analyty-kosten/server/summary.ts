import type { Db } from "./db";
import { lastBookedDate, listCategories, listExpenses } from "./repository";
import { monthlyBurnCents, nextDueDate, RECURRENCE_MONTHS, yearlyRecurringCents } from "../shared/recurrence";
import type { Expense, MoneyTotals, RecurringItem, Summary } from "../shared/types";

function emptyTotals(): MoneyTotals {
  return { exclCents: 0, vatCents: 0, inclCents: 0, count: 0 };
}

function add(totals: MoneyTotals, e: Expense): void {
  totals.exclCents += e.exclCents;
  totals.vatCents += e.vatCents;
  totals.inclCents += e.inclCents;
  totals.count += 1;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Dashboardcijfers voor een jaar, met "deze maand" = `month` van dat jaar.
 * Alle totalen tellen alleen echt geboekte kosten; terugkerende kosten tellen
 * als maandlast mee in `monthlyBurnCents`.
 */
export function buildSummary(db: Db, year: number, month: number, today = localToday()): Summary {
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  // Vanaf 1 januari (of de vorige maand, als die in het vorige jaar valt) t/m 31 december.
  const from = prevYear < year ? `${prevYear}-${pad(prevMonth)}-01` : `${year}-01-01`;
  const expenses = listExpenses(db, { from, to: `${year}-12-31` });
  const categories = listCategories(db);

  const monthKey = `${year}-${pad(month)}`;
  const prevKey = `${prevYear}-${pad(prevMonth)}`;
  const totals = { month: emptyTotals(), previousMonth: emptyTotals(), year: emptyTotals() };
  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...emptyTotals() }));
  const vatByQuarter = Array.from({ length: 4 }, (_, i) => ({ quarter: i + 1, ...emptyTotals() }));
  const byCategoryMap = new Map<string | null, MoneyTotals>();
  const spentThisMonth = new Map<string, number>();

  for (const e of expenses) {
    const key = e.date.slice(0, 7);
    if (key === prevKey) add(totals.previousMonth, e);
    if (!e.date.startsWith(`${year}-`)) continue;
    const m = Number(e.date.slice(5, 7));
    add(totals.year, e);
    add(byMonth[m - 1]!, e);
    add(vatByQuarter[Math.floor((m - 1) / 3)]!, e);
    const cat = byCategoryMap.get(e.categoryId) ?? emptyTotals();
    add(cat, e);
    byCategoryMap.set(e.categoryId, cat);
    if (key === monthKey) {
      add(totals.month, e);
      if (e.categoryId) spentThisMonth.set(e.categoryId, (spentThisMonth.get(e.categoryId) ?? 0) + e.exclCents);
    }
  }

  const byCategory = [...byCategoryMap.entries()]
    .map(([categoryId, t]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return { categoryId, name: cat?.name ?? "Zonder categorie", color: cat?.color ?? "#9a9284", ...t };
    })
    .sort((a, b) => b.exclCents - a.exclCents);

  const budgets = categories
    .filter((c) => c.monthlyBudgetCents !== null)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      color: c.color,
      budgetCents: c.monthlyBudgetCents!,
      spentCents: spentThisMonth.get(c.id) ?? 0,
    }));

  const recurringExpenses = listExpenses(db, { type: "recurring" });
  const recurring: RecurringItem[] = recurringExpenses
    .map((expense) => {
      const last = lastBookedDate(db, expense);
      const next = nextDueDate(expense.date, expense.recurrence as Exclude<Expense["recurrence"], "none">, last);
      const months = RECURRENCE_MONTHS[expense.recurrence as Exclude<Expense["recurrence"], "none">];
      return {
        expense,
        monthlyEquivalentCents: Math.round(expense.exclCents / months),
        lastBookedDate: last,
        nextDueDate: next,
        overdue: next <= today,
      };
    })
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));

  return {
    year,
    month,
    today,
    totals,
    byMonth,
    byCategory,
    vatByQuarter,
    budgets,
    recurring,
    monthlyBurnCents: monthlyBurnCents(recurringExpenses),
    yearlyRecurringCents: yearlyRecurringCents(recurringExpenses),
  };
}
