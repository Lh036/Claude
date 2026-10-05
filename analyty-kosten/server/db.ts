import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// Ingebouwde SQLite van Node (geen native module die gecompileerd moet worden).
// Geladen via require omdat sommige tools (Vitest/Vite 5) "node:sqlite" nog niet
// als ingebouwde module herkennen bij een gewone import.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
export type Db = DatabaseSyncType;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  monthly_budget_cents INTEGER,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  supplier TEXT,
  category_id TEXT REFERENCES categories(id),
  amount_cents INTEGER NOT NULL,
  amount_basis TEXT NOT NULL CHECK (amount_basis IN ('excl', 'incl')),
  vat_rate INTEGER NOT NULL CHECK (vat_rate IN (0, 9, 21)),
  excl_cents INTEGER NOT NULL,
  vat_cents INTEGER NOT NULL,
  incl_cents INTEGER NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'yearly')),
  series_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  notes TEXT,
  receipt_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (excl_cents + vat_cents = incl_cents)
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_series ON expenses(series_id);
`;

/**
 * Categoriekleuren in vaste volgorde (kleurenblind-veilige categorische
 * palette); nieuwe categorieën krijgen de volgende kleur in de rij.
 */
export const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

const DEFAULT_CATEGORIES = [
  "AI & API's",
  "Hosting & infrastructuur",
  "Software & SaaS",
  "Marketing",
  "Personeel & freelancers",
  "Kantoor",
  "Overig",
];

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  seedCategories(db);
  return db;
}

function seedCategories(db: Db): void {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM categories`).get() as { n: number };
  if (n > 0) return;
  const insert = db.prepare(
    `INSERT INTO categories (id, name, color, monthly_budget_cents, sort_order, created_at) VALUES (?, ?, ?, NULL, ?, ?)`,
  );
  const now = new Date().toISOString();
  transaction(db, () => {
    DEFAULT_CATEGORIES.forEach((name, i) => insert.run(newId("cat"), name, CATEGORY_COLORS[i % CATEGORY_COLORS.length]!, i, now));
  });
}

/** Voert `fn` uit binnen één transactie; bij een fout wordt alles teruggedraaid. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
