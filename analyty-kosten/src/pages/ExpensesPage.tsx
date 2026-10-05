import { useDeferredValue, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Download, Pencil, Plus, ReceiptText, Repeat, Search, StickyNote, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatEuro, RECURRENCE_LABELS, todayIso } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useExpenseEditor } from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { Badge, Button, buttonClasses, CategoryDot, EmptyState, ErrorBox, IconButton, Input, Modal, PageHeader, Select, Skeleton, Table, Td, Th } from "@/components/ui";
import type { Expense, ExpenseFilter } from "@shared/types";

type SortKey = "date" | "description" | "supplier" | "category" | "exclCents" | "vatCents" | "inclCents";

const PERIODS = [
  { key: "month", label: "Deze maand" },
  { key: "quarter", label: "Dit kwartaal" },
  { key: "year", label: "Dit jaar" },
  { key: "all", label: "Alles" },
] as const;

function periodRange(key: (typeof PERIODS)[number]["key"]): { from?: string; to?: string } {
  const today = todayIso();
  const y = today.slice(0, 4);
  const m = Number(today.slice(5, 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (month: number) => new Date(Number(y), month, 0).getDate();
  if (key === "month") return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay(m)}` };
  if (key === "quarter") {
    const start = Math.floor((m - 1) / 3) * 3 + 1;
    return { from: `${y}-${pad(start)}-01`, to: `${y}-${pad(start + 2)}-${lastDay(start + 2)}` };
  }
  if (key === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return {};
}

type SortState = { key: SortKey; dir: "asc" | "desc" };

function SortTh({
  k,
  sort,
  onSort,
  children,
  className,
}: {
  k: SortKey;
  sort: SortState;
  onSort: (update: (s: SortState) => SortState) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <Th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className={cn("inline-flex items-center gap-1 hover:text-[var(--color-ink)]", active && "text-[var(--color-ink)]", className?.includes("text-right") && "flex-row-reverse")}
        onClick={() => onSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
      >
        {children}
        {active && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </Th>
  );
}

export default function ExpensesPage() {
  const editor = useExpenseEditor();
  const notify = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [categoryId, setCategoryId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [type, setType] = useState<"" | "recurring" | "one-off">("");
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const filter: ExpenseFilter = { ...range, categoryId: categoryId || undefined, supplier: supplier || undefined, q: q || undefined, type: type || undefined };
  const hasFilters = Boolean(range.from || range.to || categoryId || supplier || q || type);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const expenses = useQuery({ queryKey: ["expenses", filter], queryFn: () => api.expenses(filter), placeholderData: keepPreviousData });
  const allExpenses = useQuery({ queryKey: ["expenses", {}], queryFn: () => api.expenses() });

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c]) ?? []), [categories.data]);
  const suppliers = useMemo(
    () => [...new Set((allExpenses.data ?? []).map((e) => e.supplier).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, "nl")),
    [allExpenses.data],
  );

  const rows = useMemo(() => {
    const list = [...(expenses.data ?? [])];
    const value = (e: Expense): string | number => {
      if (sort.key === "category") return e.categoryId ? (categoryById.get(e.categoryId)?.name ?? "") : "";
      if (sort.key === "supplier") return e.supplier ?? "";
      return e[sort.key];
    };
    list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "nl");
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [expenses.data, sort, categoryById]);

  const totals = rows.reduce((t, e) => ({ excl: t.excl + e.exclCents, vat: t.vat + e.vatCents, incl: t.incl + e.inclCents }), { excl: 0, vat: 0, incl: 0 });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      notify("success", "Kost verwijderd.");
      setToDelete(null);
    },
    onError: () => notify("error", "Verwijderen mislukt."),
  });

  function clearFilters() {
    setSearch("");
    setRange({});
    setCategoryId("");
    setSupplier("");
    setType("");
  }

  return (
    <div>
      <PageHeader
        title="Kosten"
        subtitle="Al je kosten op één plek. Klik op een kolomkop om te sorteren."
        actions={
          <>
            <a href={api.exportUrl(filter)} download className={buttonClasses("secondary")}>
              <Download className="h-4 w-4" />
              Exporteer CSV
            </a>
          </>
        }
      />

      {/* Filters */}
      <div className="mb-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => {
            const r = periodRange(p.key);
            const active = range.from === r.from && range.to === r.to;
            return (
              <button
                key={p.key}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  active ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white" : "border-[var(--color-border-strong)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--color-ink-faint)]" />
            <Input className="pl-9" placeholder="Zoek in omschrijving, leverancier, notities…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Zoeken" />
          </div>
          <Input type="date" aria-label="Vanaf" title="Vanaf" value={range.from ?? ""} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))} />
          <Input type="date" aria-label="Tot en met" title="Tot en met" value={range.to ?? ""} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))} />
          <Select aria-label="Categorie" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Alle categorieën</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Zonder categorie</option>
          </Select>
          <Select aria-label="Leverancier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">Alle leveranciers</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="">Alle typen</option>
            <option value="one-off">Eenmalig</option>
            <option value="recurring">Terugkerend</option>
          </Select>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            <X className="h-3.5 w-3.5" /> Filters wissen
          </button>
        )}
      </div>

      {expenses.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : expenses.isError ? (
        <ErrorBox message="Kosten konden niet geladen worden." onRetry={() => expenses.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" />}
          title={hasFilters ? "Geen kosten gevonden" : "Nog geen kosten"}
          description={hasFilters ? "Pas je filters aan of wis ze." : "Voeg je eerste kost toe — de BTW wordt automatisch uitgerekend."}
          action={
            hasFilters ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Filters wissen
              </Button>
            ) : (
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={editor.openNew}>
                Kost toevoegen
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <SortTh sort={sort} onSort={setSort} k="date">Datum</SortTh>
              <SortTh sort={sort} onSort={setSort} k="description">Omschrijving</SortTh>
              <SortTh sort={sort} onSort={setSort} k="supplier">Leverancier</SortTh>
              <SortTh sort={sort} onSort={setSort} k="category">Categorie</SortTh>
              <SortTh sort={sort} onSort={setSort} k="exclCents" className="text-right">
                Excl. BTW
              </SortTh>
              <SortTh sort={sort} onSort={setSort} k="vatCents" className="text-right">
                BTW
              </SortTh>
              <SortTh sort={sort} onSort={setSort} k="inclCents" className="text-right">
                Incl. BTW
              </SortTh>
              <Th className="sticky right-0 w-28 text-right">
                <span className="sr-only">Acties</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const cat = e.categoryId ? categoryById.get(e.categoryId) : undefined;
              return (
                <tr key={e.id} className="group hover:bg-[var(--color-surface-muted)]">
                  <Td className="whitespace-nowrap tabular-nums text-[var(--color-ink-muted)]">{formatDate(e.date)}</Td>
                  <Td className="max-w-[18rem]">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium" title={e.description}>
                        {e.description}
                      </span>
                      {e.recurrence !== "none" && (
                        <Badge tone="lime">
                          <Repeat className="h-3 w-3" /> {RECURRENCE_LABELS[e.recurrence]}
                        </Badge>
                      )}
                      {e.notes && (
                        <span title={e.notes} className="text-[var(--color-ink-faint)]">
                          <StickyNote className="h-3.5 w-3.5" aria-label="Heeft notities" />
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-[var(--color-ink-muted)]">{e.supplier ?? "—"}</Td>
                  <Td className="min-w-32">
                    {cat ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CategoryDot color={cat.color} />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-[var(--color-ink-faint)]">—</span>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{formatEuro(e.exclCents)}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums text-[var(--color-ink-muted)]">
                    <span title={`${e.vatRate}% BTW`}>{formatEuro(e.vatCents)}</span> <span className="hidden text-xs 2xl:inline">({e.vatRate}%)</span>
                  </Td>
                  <Td className="text-right font-medium whitespace-nowrap tabular-nums">{formatEuro(e.inclCents)}</Td>
                  <Td className="sticky right-0 bg-white text-right whitespace-nowrap group-hover:bg-[var(--color-surface-muted)]">
                    <div className="inline-flex gap-0.5">
                      <IconButton label="Bewerken" onClick={() => editor.openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Dupliceren" onClick={() => editor.openDuplicate(e)}>
                        <Copy className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Verwijderen" onClick={() => setToDelete(e)} className="hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]">
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--color-surface-muted)] font-semibold">
              <td className="px-4 py-3" colSpan={4}>
                Totaal · {rows.length} {rows.length === 1 ? "kost" : "kosten"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEuro(totals.excl)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEuro(totals.vat)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEuro(totals.incl)}</td>
              <td />
            </tr>
          </tfoot>
        </Table>
      )}

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Kost verwijderen?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Annuleren
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => toDelete && deleteMutation.mutate(toDelete.id)} icon={<Trash2 className="h-4 w-4" />}>
              Verwijderen
            </Button>
          </>
        }
      >
        {toDelete && (
          <p className="text-sm text-[var(--color-ink-muted)]">
            <strong className="text-[var(--color-ink)]">{toDelete.description}</strong> van {formatDate(toDelete.date)} ({formatEuro(toDelete.inclCents)} incl. BTW) wordt
            definitief verwijderd. Dit kan niet ongedaan worden gemaakt.
          </p>
        )}
      </Modal>
    </div>
  );
}
