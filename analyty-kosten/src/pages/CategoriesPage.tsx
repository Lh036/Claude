import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Tags, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Button, CategoryDot, EmptyState, ErrorBox, Field, IconButton, Input, Modal, PageHeader, Select, Skeleton, Table, Td, Th } from "@/components/ui";
import { centsToInput, parseAmountToCents } from "@shared/vat";
import type { Category } from "@shared/types";

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };
}

function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const notify = useToast();
  const invalidate = useInvalidate();
  const [name, setName] = useState(category?.name ?? "");
  const [budget, setBudget] = useState(category?.monthlyBudgetCents != null ? centsToInput(category.monthlyBudgetCents) : "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { name: string; monthlyBudgetCents: number | null }) =>
      category ? api.updateCategory(category.id, input) : api.createCategory(input),
    onSuccess: () => {
      invalidate();
      notify("success", category ? "Categorie bijgewerkt." : "Categorie toegevoegd.");
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Opslaan mislukt."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Vul een naam in.");
    const budgetCents = budget.trim() === "" ? null : parseAmountToCents(budget);
    if (budget.trim() !== "" && budgetCents === null) return setError("Vul een geldig budget in, bv. 250 of 250,00.");
    setError(null);
    mutation.mutate({ name: name.trim(), monthlyBudgetCents: budgetCents });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Categorie bewerken" : "Categorie toevoegen"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" form="category-form" loading={mutation.isPending} icon={<Save className="h-4 w-4" />}>
            Opslaan
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Naam" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Bijv. Reiskosten" />
        </Field>
        <Field label="Maandbudget excl. BTW (€)" hint="Laat leeg voor geen budget. Op het overzicht zie je hoeveel je deze maand al hebt uitgegeven.">
          <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Geen budget" />
        </Field>
        {error && <p className="rounded-xl bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      </form>
    </Modal>
  );
}

function DeleteCategoryModal({ category, categories, onClose }: { category: Category; categories: Category[]; onClose: () => void }) {
  const notify = useToast();
  const invalidate = useInvalidate();
  const others = categories.filter((c) => c.id !== category.id);
  const [target, setTarget] = useState(others.find((c) => c.name === "Overig")?.id ?? "");

  const mutation = useMutation({
    mutationFn: () => api.deleteCategory(category.id, target || null),
    onSuccess: () => {
      invalidate();
      notify("success", `Categorie "${category.name}" verwijderd.`);
      onClose();
    },
    onError: (err) => notify("error", err instanceof ApiError ? err.message : "Verwijderen mislukt."),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`"${category.name}" verwijderen?`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()} icon={<Trash2 className="h-4 w-4" />}>
            Verwijderen
          </Button>
        </>
      }
    >
      {category.expenseCount > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-ink-muted)]">
            Er {category.expenseCount === 1 ? "staat 1 kost" : `staan ${category.expenseCount} kosten`} in deze categorie. Waar moeten die naartoe?
          </p>
          <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Verplaats kosten naar">
            <option value="">Zonder categorie</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">Deze categorie heeft geen kosten en wordt definitief verwijderd.</p>
      )}
    </Modal>
  );
}

export default function CategoriesPage() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  return (
    <div>
      <PageHeader
        title="Categorieën & budgetten"
        subtitle="Groepeer je kosten en stel per categorie een maandbudget in (excl. BTW)."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
            Categorie toevoegen
          </Button>
        }
      />

      {categories.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : categories.isError ? (
        <ErrorBox message="Categorieën konden niet geladen worden." onRetry={() => categories.refetch()} />
      ) : categories.data!.length === 0 ? (
        <EmptyState icon={<Tags className="h-5 w-5" />} title="Nog geen categorieën" action={<Button onClick={() => setEditing("new")}>Categorie toevoegen</Button>} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Categorie</Th>
              <Th className="text-right">Maandbudget</Th>
              <Th className="text-right">Aantal kosten</Th>
              <Th className="w-24">
                <span className="sr-only">Acties</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {categories.data!.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--color-surface-muted)]">
                <Td>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <CategoryDot color={c.color} />
                    {c.name}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{c.monthlyBudgetCents != null ? formatEuro(c.monthlyBudgetCents) : <span className="text-[var(--color-ink-faint)]">Geen</span>}</Td>
                <Td className="text-right tabular-nums">{c.expenseCount}</Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton label="Bewerken" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Verwijderen" onClick={() => setDeleting(c)} className="hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {editing && <CategoryModal category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && categories.data && <DeleteCategoryModal category={deleting} categories={categories.data} onClose={() => setDeleting(null)} />}
    </div>
  );
}
