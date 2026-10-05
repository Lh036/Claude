import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatEuro, RECURRENCE_LABELS, todayIso } from "@/lib/format";
import { calculateVat, centsToInput, parseAmountToCents, VAT_RATES, type AmountBasis, type VatRate } from "@shared/vat";
import { RECURRENCES, type Recurrence } from "@shared/recurrence";
import type { Expense, ExpenseInput } from "@shared/types";
import { Badge, Button, Field, Input, Modal, Segmented, Select, Textarea } from "./ui";
import { useToast } from "./Toast";

export type ExpenseModalState = { mode: "new" } | { mode: "edit"; expense: Expense } | { mode: "duplicate"; expense: Expense };

interface FormState {
  date: string;
  description: string;
  supplier: string;
  categoryId: string;
  amount: string;
  amountBasis: AmountBasis;
  vatRate: VatRate;
  recurrence: Recurrence;
  notes: string;
}

function initialForm(state: ExpenseModalState): FormState {
  if (state.mode === "new") {
    return { date: todayIso(), description: "", supplier: "", categoryId: "", amount: "", amountBasis: "incl", vatRate: 21, recurrence: "none", notes: "" };
  }
  const e = state.expense;
  return {
    date: state.mode === "duplicate" ? todayIso() : e.date,
    description: e.description,
    supplier: e.supplier ?? "",
    categoryId: e.categoryId ?? "",
    amount: centsToInput(e.amountCents),
    amountBasis: e.amountBasis,
    vatRate: e.vatRate,
    recurrence: state.mode === "duplicate" ? "none" : e.recurrence,
    notes: state.mode === "duplicate" ? "" : (e.notes ?? ""),
  };
}

export function ExpenseModal({ state, onClose }: { state: ExpenseModalState; onClose: () => void }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const [form, setForm] = useState<FormState>(() => initialForm(state));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const amountCents = parseAmountToCents(form.amount);
  const preview = useMemo(() => (amountCents === null ? null : calculateVat(amountCents, form.vatRate, form.amountBasis)), [amountCents, form.vatRate, form.amountBasis]);

  const mutation = useMutation({
    mutationFn: (input: ExpenseInput) => (state.mode === "edit" ? api.updateExpense(state.expense.id, input) : api.createExpense(input)),
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      notify("success", state.mode === "edit" ? "Kost bijgewerkt." : `"${expense.description}" toegevoegd.`);
      onClose();
    },
    onError: (err) => setSubmitError(err instanceof ApiError ? err.message : "Opslaan mislukt. Probeer het opnieuw."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const next: typeof errors = {};
    if (!form.description.trim()) next.description = "Vul een omschrijving in.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = "Kies een datum.";
    if (amountCents === null) next.amount = "Vul een geldig bedrag in, bv. 49,99";
    setErrors(next);
    if (Object.keys(next).length > 0 || amountCents === null) return;

    mutation.mutate({
      date: form.date,
      description: form.description.trim(),
      supplier: form.supplier.trim() || null,
      categoryId: form.categoryId || null,
      amountCents,
      amountBasis: form.amountBasis,
      vatRate: form.vatRate,
      recurrence: form.recurrence,
      notes: form.notes.trim() || null,
    });
  }

  const title = state.mode === "edit" ? "Kost bewerken" : state.mode === "duplicate" ? "Kost dupliceren" : "Kost toevoegen";

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuleren
          </Button>
          <Button type="submit" form="expense-form" loading={mutation.isPending} icon={<Save className="h-4 w-4" />}>
            Opslaan
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Omschrijving" required error={errors.description} className="sm:col-span-2">
          <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Bijv. OpenAI API-tegoed" invalid={!!errors.description} autoFocus />
        </Field>

        <Field label="Datum" required error={errors.date}>
          <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} invalid={!!errors.date} />
        </Field>

        <Field label="Leverancier">
          <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Bijv. OpenAI" />
        </Field>

        <Field label="Categorie">
          <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Zonder categorie</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Terugkerend" hint={form.recurrence !== "none" ? "Telt mee in je vaste maandlasten op het overzicht." : undefined}>
          <Select value={form.recurrence} onChange={(e) => set("recurrence", e.target.value as Recurrence)}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bedrag (€)" required error={errors.amount}>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" invalid={!!errors.amount} className="tabular-nums" />
            </Field>
            <Field label="Dit bedrag is">
              <Segmented
                ariaLabel="Bedrag inclusief of exclusief BTW"
                value={form.amountBasis}
                onChange={(v) => set("amountBasis", v)}
                options={[
                  { value: "incl", label: "Incl. BTW" },
                  { value: "excl", label: "Excl. BTW" },
                ]}
              />
            </Field>
          </div>
          <Field label="BTW-tarief" hint="0% voor o.a. buitenlandse leveranciers met verlegde BTW.">
            <Segmented ariaLabel="BTW-tarief" value={form.vatRate} onChange={(v) => set("vatRate", v)} options={VAT_RATES.map((r) => ({ value: r, label: `${r}%` }))} />
          </Field>
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-center text-sm">
            <div>
              <dt className="text-xs text-[var(--color-ink-muted)]">Excl. BTW</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{preview ? formatEuro(preview.exclCents) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-muted)]">BTW {form.vatRate}%</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{preview ? formatEuro(preview.vatCents) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-muted)]">Incl. BTW</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{preview ? formatEuro(preview.inclCents) : "—"}</dd>
            </div>
          </dl>
        </div>

        <Field label="Notities" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Extra info, factuurnummer, waarvoor het is…" />
        </Field>

        <Field
          label="Link naar bon / factuur"
          className="sm:col-span-2"
          badge={<Badge tone="warning">Nog niet in gebruik</Badge>}
          hint="Wordt later gekoppeld aan je bonnen-systeem."
        >
          <Input disabled placeholder="https://…" value={state.mode === "edit" ? (state.expense.receiptUrl ?? "") : ""} readOnly />
        </Field>

        {submitError && <p className="rounded-xl bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)] sm:col-span-2">{submitError}</p>}
      </form>
    </Modal>
  );
}
