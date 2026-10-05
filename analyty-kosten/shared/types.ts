import type { AmountBasis, VatRate } from "./vat";
import type { Recurrence } from "./recurrence";

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Maandbudget exclusief BTW, in centen. null = geen budget. */
  monthlyBudgetCents: number | null;
  sortOrder: number;
  expenseCount: number;
  createdAt: string;
}

export interface CategoryInput {
  name: string;
  color?: string;
  monthlyBudgetCents?: number | null;
}

export interface Expense {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  supplier: string | null;
  categoryId: string | null;
  /** Het bedrag zoals ingevoerd, plus of dat incl. of excl. BTW was. */
  amountCents: number;
  amountBasis: AmountBasis;
  vatRate: VatRate;
  exclCents: number;
  vatCents: number;
  inclCents: number;
  recurrence: Recurrence;
  /** Bij een geboekte termijn: het id van de terugkerende kost waar hij bij hoort. */
  seriesId: string | null;
  notes: string | null;
  /** Link naar bon/factuur. Nog niet in gebruik in de interface. */
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  date: string;
  description: string;
  supplier?: string | null;
  categoryId?: string | null;
  amountCents: number;
  amountBasis: AmountBasis;
  vatRate: VatRate;
  recurrence?: Recurrence;
  notes?: string | null;
  receiptUrl?: string | null;
}

export interface ExpenseFilter {
  from?: string;
  to?: string;
  categoryId?: string;
  supplier?: string;
  q?: string;
  type?: "recurring" | "one-off";
}

export interface MoneyTotals {
  exclCents: number;
  vatCents: number;
  inclCents: number;
  count: number;
}

export interface RecurringItem {
  expense: Expense;
  monthlyEquivalentCents: number;
  lastBookedDate: string;
  nextDueDate: string;
  overdue: boolean;
}

export interface Summary {
  year: number;
  month: number;
  today: string;
  totals: { month: MoneyTotals; previousMonth: MoneyTotals; year: MoneyTotals };
  byMonth: (MoneyTotals & { month: number })[];
  byCategory: (MoneyTotals & { categoryId: string | null; name: string; color: string })[];
  vatByQuarter: (MoneyTotals & { quarter: number })[];
  budgets: { categoryId: string; name: string; color: string; budgetCents: number; spentCents: number }[];
  recurring: RecurringItem[];
  monthlyBurnCents: number;
  yearlyRecurringCents: number;
}
