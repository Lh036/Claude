import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z, ZodError } from "zod";
import type { Db } from "./db";
import {
  bookNextOccurrence,
  ConflictError,
  createCategory,
  createExpense,
  deleteCategory,
  deleteExpense,
  getExpense,
  listCategories,
  listExpenses,
  NotFoundError,
  updateCategory,
  updateExpense,
} from "./repository";
import { buildSummary, localToday } from "./summary";
import { expensesToCsv } from "./csv";
import { VAT_RATES } from "../shared/vat";
import { RECURRENCES } from "../shared/recurrence";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum moet JJJJ-MM-DD zijn")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "Ongeldige datum");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

const expenseInput = z.object({
  date: isoDate,
  description: z.string().trim().min(1, "Omschrijving is verplicht").max(300),
  supplier: optionalText(150),
  categoryId: z.string().min(1).nullable().optional(),
  amountCents: z.number().int("Bedrag moet in hele centen").min(0).max(100_000_000_000),
  amountBasis: z.enum(["excl", "incl"]),
  vatRate: z.union(VAT_RATES.map((r) => z.literal(r)) as unknown as [z.ZodLiteral<0>, z.ZodLiteral<9>, z.ZodLiteral<21>]),
  recurrence: z.enum(RECURRENCES).optional(),
  notes: optionalText(5000),
  receiptUrl: z
    .string()
    .trim()
    .url("Ongeldige link")
    .refine((u) => /^https?:\/\//i.test(u), "Alleen http(s)-links")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

const categoryInput = z.object({
  name: z.string().trim().min(1, "Naam is verplicht").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  monthlyBudgetCents: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
});

const expenseFilter = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.string().min(1).optional(),
  supplier: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  type: z.enum(["recurring", "one-off"]).optional(),
});

type Handler = (req: Request, res: Response) => void;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  try {
    fn(req, res);
  } catch (err) {
    next(err);
  }
};

export function createApp(db: Db, options: { staticDir?: string } = {}): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const api = express.Router();

  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Categorieën
  api.get("/categories", wrap((_req, res) => res.json(listCategories(db))));
  api.post("/categories", wrap((req, res) => res.status(201).json(createCategory(db, categoryInput.parse(req.body)))));
  api.patch("/categories/:id", wrap((req, res) => res.json(updateCategory(db, req.params.id!, categoryInput.partial().parse(req.body)))));
  api.delete(
    "/categories/:id",
    wrap((req, res) => {
      const reassignTo = typeof req.query.reassignTo === "string" && req.query.reassignTo ? req.query.reassignTo : null;
      deleteCategory(db, req.params.id!, reassignTo);
      res.status(204).end();
    }),
  );

  // Kosten
  api.get("/expenses", wrap((req, res) => res.json(listExpenses(db, expenseFilter.parse(req.query)))));
  api.get(
    "/expenses/export.csv",
    wrap((req, res) => {
      const csv = expensesToCsv(listExpenses(db, expenseFilter.parse(req.query)), listCategories(db));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="analyty-kosten-${localToday()}.csv"`);
      res.send(csv);
    }),
  );
  api.get(
    "/expenses/:id",
    wrap((req, res) => {
      const expense = getExpense(db, req.params.id!);
      if (!expense) throw new NotFoundError("Kost niet gevonden");
      res.json(expense);
    }),
  );
  api.post("/expenses", wrap((req, res) => res.status(201).json(createExpense(db, expenseInput.parse(req.body)))));
  api.patch("/expenses/:id", wrap((req, res) => res.json(updateExpense(db, req.params.id!, expenseInput.partial().parse(req.body)))));
  api.delete(
    "/expenses/:id",
    wrap((req, res) => {
      deleteExpense(db, req.params.id!);
      res.status(204).end();
    }),
  );
  api.post("/expenses/:id/book-next", wrap((req, res) => res.status(201).json(bookNextOccurrence(db, req.params.id!))));

  // Dashboard
  api.get(
    "/summary",
    wrap((req, res) => {
      const today = localToday();
      const query = z
        .object({
          year: z.coerce.number().int().min(2000).max(2100).optional(),
          month: z.coerce.number().int().min(1).max(12).optional(),
        })
        .parse(req.query);
      const year = query.year ?? Number(today.slice(0, 4));
      // Voor een ander jaar dan het huidige is "deze maand" december, tenzij anders opgegeven.
      const month = query.month ?? (year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12);
      res.json(buildSummary(db, year, month, today));
    }),
  );

  app.use("/api", api);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found", message: "Onbekend endpoint" });
  });

  // Productie: de gebouwde frontend serveren (SPA-fallback naar index.html).
  if (options.staticDir && existsSync(options.staticDir)) {
    app.use(express.static(options.staticDir));
    app.get("*", (_req, res) => res.sendFile(join(options.staticDir!, "index.html")));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      res.status(400).json({ error: "validation_error", message: first ? `${first.path.join(".") || "invoer"}: ${first.message}` : "Ongeldige invoer" });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: "not_found", message: err.message });
      return;
    }
    if (err instanceof ConflictError) {
      res.status(409).json({ error: "conflict", message: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "invalid_json", message: "Ongeldige JSON" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal_error", message: "Er ging iets mis" });
  });

  return app;
}
