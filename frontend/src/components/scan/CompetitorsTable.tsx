import { useMemo, useState } from "react";
import { ArrowUpDown, Users } from "lucide-react";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber, formatOrdinal, PROVIDER_LABELS, QUESTION_CATEGORY_LABELS } from "@/lib/format";
import type { CompetitorAggregate } from "@/lib/types";

type SortKey = "mentions" | "averagePosition" | "providers" | "questions";

export function CompetitorsTable({ competitors }: { competitors: CompetitorAggregate[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("mentions");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const withMetrics = competitors.map((c) => ({
      ...c,
      providerCount: Object.keys(c.providers).length,
      questionCount: c.questionIds.length,
    }));
    const key = (c: (typeof withMetrics)[number]) => {
      switch (sortKey) {
        case "mentions":
          return c.mentions;
        case "averagePosition":
          return c.averagePosition ?? Number.POSITIVE_INFINITY;
        case "providers":
          return c.providerCount;
        case "questions":
          return c.questionCount;
      }
    };
    return withMetrics.sort((a, b) => (asc ? key(a) - key(b) : key(b) - key(a)));
  }, [competitors, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="No competitors detected"
        description="Competitors are detected automatically when AI answers mention other companies alongside — or instead of — this business."
      />
    );
  }

  const SortButton = ({ label, k }: { label: string; k: SortKey }) => (
    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]">
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Competitor</Th>
          <Th>
            <SortButton label="Mentions" k="mentions" />
          </Th>
          <Th>
            <SortButton label="Avg. position" k="averagePosition" />
          </Th>
          <Th>
            <SortButton label="Providers" k="providers" />
          </Th>
          <Th>
            <SortButton label="Questions" k="questions" />
          </Th>
          <Th>Categories</Th>
        </Tr>
      </THead>
      <TBody>
        {sorted.map((c) => (
          <Tr key={c.name}>
            <Td className="font-medium">{c.name}</Td>
            <Td>{formatNumber(c.mentions)}</Td>
            <Td>{c.averagePosition === null ? "—" : formatOrdinal(Math.round(c.averagePosition))}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {Object.entries(c.providers).map(([p, n]) => (
                  <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-[var(--color-ink-muted)]">
                    {PROVIDER_LABELS[p as keyof typeof PROVIDER_LABELS] ?? p} ({n})
                  </span>
                ))}
              </div>
            </Td>
            <Td>{formatNumber(c.questionIds.length)}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {c.categories.map((cat) => (
                  <span key={cat} className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-xs text-[var(--color-accent)]">
                    {QUESTION_CATEGORY_LABELS[cat] ?? cat}
                  </span>
                ))}
              </div>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
