import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatEuro, formatEuroShort, MONTHS_LONG, MONTHS_SHORT, RECURRENCE_LABELS } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useExpenseEditor } from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, CardHeader, CategoryDot, ErrorBox, IconButton, PageHeader, Segmented, Skeleton, StatCard } from "@/components/ui";
import type { Summary } from "@shared/types";

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const editor = useExpenseEditor();
  const summary = useQuery({ queryKey: ["summary", year], queryFn: () => api.summary(year), placeholderData: keepPreviousData });

  return (
    <div>
      <PageHeader
        title="Overzicht"
        subtitle="Bedragen zijn exclusief BTW, tenzij anders vermeld."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-[var(--color-border-strong)] bg-white px-1 py-0.5">
            <IconButton label="Vorig jaar" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <span className="w-12 text-center text-sm font-semibold tabular-nums">{year}</span>
            <IconButton label="Volgend jaar" onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear + 1}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        }
      />

      {summary.isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : summary.isError || !summary.data ? (
        <ErrorBox message="Het overzicht kon niet geladen worden." onRetry={() => summary.refetch()} />
      ) : (
        <Dashboard data={summary.data} onAdd={editor.openNew} />
      )}
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <>Vorige maand: {formatEuro(0)}</>;
  const pct = Math.round(((current - previous) / previous) * 100);
  return (
    <>
      {pct > 0 ? "+" : ""}
      {pct}% t.o.v. vorige maand ({formatEuro(previous)})
    </>
  );
}

function Dashboard({ data, onAdd }: { data: Summary; onAdd: () => void }) {
  const monthName = MONTHS_LONG[data.month - 1];
  const isEmpty = data.totals.year.count === 0 && data.recurring.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          highlight
          label={`Kosten ${monthName}`}
          value={formatEuro(data.totals.month.exclCents)}
          hint={<Delta current={data.totals.month.exclCents} previous={data.totals.previousMonth.exclCents} />}
        />
        <StatCard label={`Kosten ${data.year}`} value={formatEuro(data.totals.year.exclCents)} hint={`${data.totals.year.count} kosten · ${formatEuro(data.totals.year.inclCents)} incl. BTW`} />
        <StatCard label={`Betaalde BTW ${data.year}`} value={formatEuro(data.totals.year.vatCents)} hint="Voorbelasting, terug te vragen via aangifte" />
        <StatCard
          label="Vaste lasten per maand"
          value={formatEuro(data.monthlyBurnCents)}
          hint={`${data.recurring.length} terugkerend · ${formatEuro(data.yearlyRecurringCents)} per jaar`}
        />
      </div>

      {isEmpty && (
        <Card className="flex flex-col items-start gap-3 bg-[var(--color-lime-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Nog geen kosten in {data.year}</h2>
            <p className="text-sm text-[var(--color-ink-muted)]">Voeg je eerste kost toe; het overzicht vult zich vanzelf.</p>
          </div>
          <Button icon={<Plus className="h-4 w-4" />} onClick={onAdd}>
            Kost toevoegen
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <MonthlyChart data={data} />
        <CategoryBreakdown data={data} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Budgets data={data} />
        <RecurringList data={data} />
      </div>

      <VatQuarters data={data} />
    </div>
  );
}

function MonthlyChart({ data }: { data: Summary }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const rows = data.byMonth.map((m) => ({ ...m, label: MONTHS_SHORT[m.month - 1]! }));

  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title={`Kosten per maand · ${data.year}`}
        subtitle="Excl. BTW"
        action={
          <div className="w-40">
            <Segmented
              ariaLabel="Weergave"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Grafiek" },
                { value: "table", label: "Tabel" },
              ]}
            />
          </div>
        }
      />
      {view === "chart" ? (
        <div className="h-72 px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="#ece5d8" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d5c9b4" }} tick={{ fill: "#5f584d", fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fill: "#5f584d", fontSize: 12 }}
                tickFormatter={(v: number) => formatEuroShort(v)}
              />
              <Tooltip cursor={{ fill: "#f5f0e6" }} content={<MonthTooltip />} />
              <Bar dataKey="exclCents" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {rows.map((r) => (
                  <Cell key={r.month} fill={r.month === data.month ? "#141414" : "#8a8273"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-ink-muted)]">
                <th className="py-2 font-semibold">Maand</th>
                <th className="py-2 text-right font-semibold">Excl. BTW</th>
                <th className="py-2 text-right font-semibold">BTW</th>
                <th className="py-2 text-right font-semibold">Incl. BTW</th>
                <th className="py-2 text-right font-semibold">Aantal</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.month} className={cn("border-t border-[var(--color-border)]", r.month === data.month && "font-semibold")}>
                  <td className="py-1.5 capitalize">{MONTHS_LONG[r.month - 1]}</td>
                  <td className="py-1.5 text-right">{formatEuro(r.exclCents)}</td>
                  <td className="py-1.5 text-right">{formatEuro(r.vatCents)}</td>
                  <td className="py-1.5 text-right">{formatEuro(r.inclCents)}</td>
                  <td className="py-1.5 text-right">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MonthTooltip({ active, payload }: { active?: boolean; payload?: { payload: Summary["byMonth"][number] }[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold capitalize">{MONTHS_LONG[row.month - 1]}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-4 tabular-nums">
        <span className="text-[var(--color-ink-muted)]">Excl. BTW</span>
        <span className="text-right font-semibold">{formatEuro(row.exclCents)}</span>
        <span className="text-[var(--color-ink-muted)]">BTW</span>
        <span className="text-right">{formatEuro(row.vatCents)}</span>
        <span className="text-[var(--color-ink-muted)]">Incl. BTW</span>
        <span className="text-right">{formatEuro(row.inclCents)}</span>
        <span className="text-[var(--color-ink-muted)]">Aantal</span>
        <span className="text-right">{row.count}</span>
      </div>
    </div>
  );
}

function CategoryBreakdown({ data }: { data: Summary }) {
  const total = data.totals.year.exclCents;
  return (
    <Card>
      <CardHeader title={`Per categorie · ${data.year}`} subtitle="Excl. BTW" />
      <div className="space-y-3 px-5 pb-5">
        {data.byCategory.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Nog geen kosten dit jaar.</p>
        ) : (
          data.byCategory.map((c) => {
            const pct = total > 0 ? (c.exclCents / total) * 100 : 0;
            return (
              <div key={c.categoryId ?? "none"}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <CategoryDot color={c.color} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="font-semibold">{formatEuro(c.exclCents)}</span>{" "}
                    <span className="text-xs text-[var(--color-ink-muted)]">{Math.round(pct)}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-canvas)]">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: c.color }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function Budgets({ data }: { data: Summary }) {
  const monthName = MONTHS_LONG[data.month - 1];
  return (
    <Card>
      <CardHeader title={`Budgetten · ${monthName}`} subtitle="Uitgegeven deze maand t.o.v. maandbudget (excl. BTW)" />
      <div className="space-y-4 px-5 pb-5">
        {data.budgets.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Nog geen budgetten ingesteld. Stel ze in via{" "}
            <Link to="/categorieen" className="font-medium text-[var(--color-ink)] underline underline-offset-2">
              Categorieën & budgetten
            </Link>
            .
          </p>
        ) : (
          data.budgets.map((b) => {
            const pct = b.budgetCents > 0 ? (b.spentCents / b.budgetCents) * 100 : b.spentCents > 0 ? 101 : 0;
            const over = b.spentCents > b.budgetCents;
            const near = !over && pct >= 80;
            return (
              <div key={b.categoryId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <CategoryDot color={b.color} />
                    <span className="truncate">{b.name}</span>
                  </span>
                  {over ? (
                    <Badge tone="danger">
                      <AlertTriangle className="h-3 w-3" /> Over budget
                    </Badge>
                  ) : near ? (
                    <Badge tone="warning">
                      <AlertTriangle className="h-3 w-3" /> Bijna op
                    </Badge>
                  ) : (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" /> Binnen budget
                    </Badge>
                  )}
                </div>
                <div className="h-2 rounded-full bg-[var(--color-canvas)]">
                  <div
                    className={cn("h-2 rounded-full", over ? "bg-[var(--color-danger)]" : near ? "bg-[var(--color-warning)]" : "bg-[var(--color-ink)]")}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-[var(--color-ink-muted)] tabular-nums">
                  {formatEuro(b.spentCents)} van {formatEuro(b.budgetCents)}
                  {over ? ` · ${formatEuro(b.spentCents - b.budgetCents)} te veel` : ` · ${formatEuro(b.budgetCents - b.spentCents)} over`}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function RecurringList({ data }: { data: Summary }) {
  const notify = useToast();
  const queryClient = useQueryClient();
  const book = useMutation({
    mutationFn: api.bookNext,
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      notify("success", `Termijn van ${formatDate(expense.date)} geboekt.`);
    },
    onError: () => notify("error", "Boeken mislukt."),
  });

  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Terugkerende kosten" subtitle="Abonnementen en vaste lasten, gesorteerd op eerstvolgende termijn" />
      {data.recurring.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-[var(--color-ink-muted)]">
          Nog geen terugkerende kosten. Zet bij een kost <em>Terugkerend</em> op maandelijks, per kwartaal of jaarlijks.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] px-5 pb-2">
          {data.recurring.map((r) => (
            <li key={r.expense.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Repeat className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-ink-muted)]" />
                  <span className="truncate font-medium">{r.expense.description}</span>
                  {r.expense.supplier && <span className="truncate text-sm text-[var(--color-ink-muted)]">· {r.expense.supplier}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-muted)] tabular-nums">
                  <span>
                    {formatEuro(r.expense.exclCents)} {RECURRENCE_LABELS[r.expense.recurrence].toLowerCase()}
                  </span>
                  <span>≈ {formatEuro(r.monthlyEquivalentCents)} p/m</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> Volgende: {formatDate(r.nextDueDate)}
                  </span>
                  {r.overdue && (
                    <Badge tone="warning">
                      <AlertTriangle className="h-3 w-3" /> Nog niet geboekt
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={r.overdue ? "lime" : "secondary"}
                className="flex-shrink-0"
                loading={book.isPending && book.variables === r.expense.id}
                onClick={() => book.mutate(r.expense.id)}
                title={`Boekt ${formatEuro(r.expense.inclCents)} incl. BTW op ${formatDate(r.nextDueDate)}`}
              >
                Boek termijn {formatDate(r.nextDueDate)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function VatQuarters({ data }: { data: Summary }) {
  return (
    <Card>
      <CardHeader title={`BTW per kwartaal · ${data.year}`} subtitle="Betaalde BTW op je kosten (voorbelasting) — handig voor je kwartaalaangifte" />
      <div className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-4">
        {data.vatByQuarter.map((q) => (
          <div key={q.quarter} className="rounded-xl bg-[var(--color-surface-muted)] p-3">
            <div className="text-xs font-semibold text-[var(--color-ink-muted)]">Q{q.quarter}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatEuro(q.vatCents)}</div>
            <div className="text-xs text-[var(--color-ink-muted)] tabular-nums">over {formatEuro(q.exclCents)} excl.</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
