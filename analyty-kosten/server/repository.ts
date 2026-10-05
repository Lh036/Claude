import { CATEGORY_COLORS, newId, type Db } from "./db";
import { calculateVat } from "../shared/vat";
import { nextDueDate } from "../shared/recurrence";
import type { Category, CategoryInput, Expense, ExpenseFilter, ExpenseInput } from "../shared/types";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

// --- Categorieën -------------------------------------------------------------

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  monthly_budget_cents: number | null;
  sort_order: number;
  created_at: string;
  expense_count: number;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    monthlyBudgetCents: row.monthly_budget_cents,
    sortOrder: row.sort_order,
    expenseCount: row.expense_count,
    createdAt: row.created_at,
  };
}

const CATEGORY_SELECT = `
  SELECT c.*, (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) AS expense_count
  FROM categories c`;

export function listCategories(db: Db): Category[] {
  return (db.prepare(`${CATEGORY_SELECT} ORDER BY c.sort_order, c.name`).all() as CategoryRow[]).map(rowToCategory);
}

export function getCategory(db: Db, id: string): Category | null {
  const row = db.prepare(`${CATEGORY_SELECT} WHERE c.id = ?`).get(id) as CategoryRow | undefined;
  return row ? rowToCategory(row) : null;
}

function assertUniqueName(db: Db, name: string, exceptId?: string): void {
  const clash = db.prepare(`SELECT id FROM categories WHERE name = ? COLLATE NOCASE`).get(name) as { id: string } | undefined;
  if (clash && clash.id !== exceptId) throw new ConflictError(`Er bestaat al een categorie "${name}"`);
}

export function createCategory(db: Db, input: CategoryInput): Category {
  assertUniqueName(db, input.name);
  const { maxOrder, n } = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS maxOrder, COUNT(*) AS n FROM categories`).get() as {
    maxOrder: number;
    n: number;
  };
  const id = newId("cat");
  db.prepare(
    `INSERT INTO categories (id, name, color, monthly_budget_cents, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.color ?? CATEGORY_COLORS[n % CATEGORY_COLORS.length], input.monthlyBudgetCents ?? null, maxOrder + 1, new Date().toISOString());
  return getCategory(db, id)!;
}

export function updateCategory(db: Db, id: string, patch: Partial<CategoryInput>): Category {
  const existing = getCategory(db, id);
  if (!existing) throw new NotFoundError("Categorie niet gevonden");
  if (patch.name !== undefined) assertUniqueName(db, patch.name, id);
  db.prepare(`UPDATE categories SET name = ?, color = ?, monthly_budget_cents = ? WHERE id = ?`).run(
    patch.name ?? existing.name,
    patch.color ?? existing.color,
    patch.monthlyBudgetCents !== undefined ? patch.monthlyBudgetCents : existing.monthlyBudgetCents,
    id,
  );
  return getCategory(db, id)!;
}

/**
 * Verwijdert een categorie. Kosten in die categorie worden verplaatst naar
 * `reassignTo`, of worden "zonder categorie" als die niet is opgegeven.
 */
export function deleteCategory(db: Db, id: string, reassignTo: string | null): void {
  if (!getCategory(db, id)) throw new NotFoundError("Categorie niet gevonden");
  if (reassignTo !== null) {
    if (reassignTo === id) throw new ConflictError("Kies een andere categorie om de kosten naartoe te verplaatsen");
    if (!getCategory(db, reassignTo)) throw new NotFoundError("Doelcategorie niet gevonden");
  }
  db.transaction(() => {
    db.prepare(`UPDATE expenses SET category_id = ? WHERE category_id = ?`).run(reassignTo, id);
    db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  })();
}

// --- Kosten ------------------------------------------------------------------

interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  supplier: string | null;
  category_id: string | null;
  amount_cents: number;
  amount_basis: Expense["amountBasis"];
  vat_rate: Expense["vatRate"];
  excl_cents: number;
  vat_cents: number;
  incl_cents: number;
  recurrence: Expense["recurrence"];
  series_id: string | null;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    supplier: row.supplier,
    categoryId: row.category_id,
    amountCents: row.amount_cents,
    amountBasis: row.amount_basis,
    vatRate: row.vat_rate,
    exclCents: row.excl_cents,
    vatCents: row.vat_cents,
    inclCents: row.incl_cents,
    recurrence: row.recurrence,
    seriesId: row.series_id,
    notes: row.notes,
    receiptUrl: row.receipt_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listExpenses(db: Db, filter: ExpenseFilter = {}): Expense[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (filter.from) {
    where.push("date >= @from");
    params.from = filter.from;
  }
  if (filter.to) {
    where.push("date <= @to");
    params.to = filter.to;
  }
  if (filter.categoryId === "none") {
    where.push("category_id IS NULL");
  } else if (filter.categoryId) {
    where.push("category_id = @categoryId");
    params.categoryId = filter.categoryId;
  }
  if (filter.supplier) {
    where.push("supplier = @supplier COLLATE NOCASE");
    params.supplier = filter.supplier;
  }
  if (filter.q) {
    where.push("(description LIKE @q ESCAPE '\\' OR supplier LIKE @q ESCAPE '\\' OR notes LIKE @q ESCAPE '\\')");
    params.q = `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  }
  if (filter.type === "recurring") where.push("recurrence <> 'none'");
  if (filter.type === "one-off") where.push("recurrence = 'none'");

  const sql = `SELECT * FROM expenses ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY date DESC, created_at DESC`;
  return (db.prepare(sql).all(params) as ExpenseRow[]).map(rowToExpense);
}

export function getExpense(db: Db, id: string): Expense | null {
  const row = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id) as ExpenseRow | undefined;
  return row ? rowToExpense(row) : null;
}

function assertCategoryExists(db: Db, categoryId: string | null | undefined): void {
  if (categoryId && !getCategory(db, categoryId)) throw new NotFoundError("Categorie niet gevonden");
}

function insertExpense(db: Db, input: ExpenseInput, seriesId: string | null): Expense {
  assertCategoryExists(db, input.categoryId);
  // De server rekent de BTW altijd zelf uit; bedragen van de client worden nooit overgenomen.
  const vat = calculateVat(input.amountCents, input.vatRate, input.amountBasis);
  const now = new Date().toISOString();
  const id = newId("exp");
  db.prepare(
    `INSERT INTO expenses (id, date, description, supplier, category_id, amount_cents, amount_basis, vat_rate,
       excl_cents, vat_cents, incl_cents, recurrence, series_id, notes, receipt_url, created_at, updated_at)
     VALUES (@id, @date, @description, @supplier, @categoryId, @amountCents, @amountBasis, @vatRate,
       @exclCents, @vatCents, @inclCents, @recurrence, @seriesId, @notes, @receiptUrl, @now, @now)`,
  ).run({
    id,
    date: input.date,
    description: input.description,
    supplier: input.supplier ?? null,
    categoryId: input.categoryId ?? null,
    amountCents: input.amountCents,
    amountBasis: input.amountBasis,
    vatRate: input.vatRate,
    exclCents: vat.exclCents,
    vatCents: vat.vatCents,
    inclCents: vat.inclCents,
    recurrence: input.recurrence ?? "none",
    seriesId,
    notes: input.notes ?? null,
    receiptUrl: input.receiptUrl ?? null,
    now,
  });
  return getExpense(db, id)!;
}

export function createExpense(db: Db, input: ExpenseInput): Expense {
  return insertExpense(db, input, null);
}

export function updateExpense(db: Db, id: string, patch: Partial<ExpenseInput>): Expense {
  const existing = getExpense(db, id);
  if (!existing) throw new NotFoundError("Kost niet gevonden");
  const merged: ExpenseInput = {
    date: patch.date ?? existing.date,
    description: patch.description ?? existing.description,
    supplier: patch.supplier !== undefined ? patch.supplier : existing.supplier,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
    amountCents: patch.amountCents ?? existing.amountCents,
    amountBasis: patch.amountBasis ?? existing.amountBasis,
    vatRate: patch.vatRate ?? existing.vatRate,
    recurrence: patch.recurrence ?? existing.recurrence,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    receiptUrl: patch.receiptUrl !== undefined ? patch.receiptUrl : existing.receiptUrl,
  };
  assertCategoryExists(db, merged.categoryId);
  const vat = calculateVat(merged.amountCents, merged.vatRate, merged.amountBasis);
  db.prepare(
    `UPDATE expenses SET date=@date, description=@description, supplier=@supplier, category_id=@categoryId,
       amount_cents=@amountCents, amount_basis=@amountBasis, vat_rate=@vatRate, excl_cents=@exclCents,
       vat_cents=@vatCents, incl_cents=@inclCents, recurrence=@recurrence, notes=@notes, receipt_url=@receiptUrl,
       updated_at=@now
     WHERE id=@id`,
  ).run({
    ...merged,
    supplier: merged.supplier ?? null,
    categoryId: merged.categoryId ?? null,
    notes: merged.notes ?? null,
    receiptUrl: merged.receiptUrl ?? null,
    exclCents: vat.exclCents,
    vatCents: vat.vatCents,
    inclCents: vat.inclCents,
    now: new Date().toISOString(),
    id,
  });
  return getExpense(db, id)!;
}

export function deleteExpense(db: Db, id: string): void {
  const result = db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
  if (result.changes === 0) throw new NotFoundError("Kost niet gevonden");
}

/** Datum van de laatst geboekte termijn van een terugkerende kost (de kost zelf telt mee). */
export function lastBookedDate(db: Db, seriesExpense: Expense): string {
  const row = db.prepare(`SELECT MAX(date) AS last FROM expenses WHERE series_id = ?`).get(seriesExpense.id) as { last: string | null };
  return row.last && row.last > seriesExpense.date ? row.last : seriesExpense.date;
}

/**
 * Boekt de volgende termijn van een terugkerende kost als losse kost (zelfde
 * bedrag, leverancier en categorie; datum = eerstvolgende vervaldatum).
 */
export function bookNextOccurrence(db: Db, id: string): Expense {
  const series = getExpense(db, id);
  if (!series) throw new NotFoundError("Kost niet gevonden");
  if (series.recurrence === "none") throw new ConflictError("Deze kost is niet terugkerend");
  const date = nextDueDate(series.date, series.recurrence, lastBookedDate(db, series));
  return insertExpense(
    db,
    {
      date,
      description: series.description,
      supplier: series.supplier,
      categoryId: series.categoryId,
      amountCents: series.amountCents,
      amountBasis: series.amountBasis,
      vatRate: series.vatRate,
      recurrence: "none",
      notes: null,
      receiptUrl: null,
    },
    series.id,
  );
}
