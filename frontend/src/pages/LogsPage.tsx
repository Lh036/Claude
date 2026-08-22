import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowUpDown, ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { LogLevelBadge } from "@/components/ui/StatusBadge";
import { FieldWrap, Select, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { logApi, scanApi } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import { formatDate, PROVIDER_LABELS, truncate } from "@/lib/format";
import type { LogEntry, LogLevel, ProviderName } from "@/lib/types";

const LIMIT = 50;
const LEVEL_OPTIONS: LogLevel[] = ["DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR"];
const PROVIDER_OPTIONS = Object.keys(PROVIDER_LABELS) as ProviderName[];

function shortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

/** A professional, full log viewer over every entry the backend has recorded — the firehose (see /activity for a curated feed). */
export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const level = searchParams.get("level") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const scanId = searchParams.get("scanId") ?? "";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const offset = Number(searchParams.get("offset") ?? "0") || 0;
  const q = searchParams.get("q") ?? "";

  const [searchInput, setSearchInput] = useState(q);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const businessMap = useBusinessMap();

  // Keep the input in sync when the URL changes externally (back/forward navigation).
  useEffect(() => {
    setSearchInput(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Debounce free-text search before it becomes a real `q` query param / API call.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== q) updateParams({ q: searchInput || undefined, offset: undefined });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateParams(patch: Record<string, string | undefined>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  const scansQuery = useQuery({ queryKey: ["scans", "picker", 200], queryFn: () => scanApi.list({ limit: 200 }) });

  const logsQuery = useQuery({
    queryKey: ["logs", { level, provider, scanId, q, order, offset }],
    queryFn: () =>
      logApi.query({
        level: level || undefined,
        provider: provider || undefined,
        scanId: scanId || undefined,
        q: q || undefined,
        order,
        limit: LIMIT,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const entries = logsQuery.data?.entries ?? [];
  const total = logsQuery.data?.total ?? 0;
  const hasFilters = !!level || !!provider || !!scanId || !!q;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + entries.length, total);

  return (
    <div>
      <PageHeader title="Logs" subtitle="Every log entry the backend has recorded, filterable and searchable." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <FieldWrap label="Level">
            <Select value={level} onChange={(e) => updateParams({ level: e.target.value, offset: undefined })}>
              <option value="">All levels</option>
              {LEVEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
        <div className="w-44">
          <FieldWrap label="Provider">
            <Select value={provider} onChange={(e) => updateParams({ provider: e.target.value, offset: undefined })}>
              <option value="">All providers</option>
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
        <div className="w-64">
          <FieldWrap label="Scan">
            <Select value={scanId} onChange={(e) => updateParams({ scanId: e.target.value, offset: undefined })} disabled={scansQuery.isLoading}>
              <option value="">All scans</option>
              {scansQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  #{shortId(s.id)} — {businessMap.map[s.businessId]?.companyName ?? "Unknown business"}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
        <div className="w-64 flex-1 min-w-[16rem]">
          <FieldWrap label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]" />
              <Input
                className="pl-8"
                placeholder="Search event or message…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </FieldWrap>
        </div>
        <Button
          variant="secondary"
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          onClick={() => updateParams({ order: order === "desc" ? "asc" : "desc", offset: undefined })}
        >
          {order === "desc" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {logsQuery.isLoading ? (
        <SkeletonTable rows={10} cols={6} />
      ) : logsQuery.isError ? (
        <ErrorState message="Could not load logs." onRetry={() => logsQuery.refetch()} />
      ) : entries.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No log entries match your filters" description="Try loosening the level, provider, scan, or search filter." />
        ) : (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No log entries yet" description="Entries will appear here as scans run." />
        )
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Timestamp</Th>
                <Th>Level</Th>
                <Th>Event</Th>
                <Th>Message</Th>
                <Th>Scan</Th>
                <Th>Provider</Th>
              </Tr>
            </THead>
            <TBody>
              {entries.map((entry) => (
                <Tr key={entry.id ?? `${entry.timestamp}-${entry.event}`} clickable onClick={() => setSelected(entry)}>
                  <Td className="whitespace-nowrap font-mono text-xs text-[var(--color-ink-muted)]">{formatDate(entry.timestamp)}</Td>
                  <Td>
                    <LogLevelBadge level={entry.level} />
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{entry.event}</Td>
                  <Td className="max-w-md text-sm">{truncate(entry.message, 100)}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">
                    {entry.scanId ? (
                      <Link
                        to={`/scans/${entry.scanId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        #{shortId(entry.scanId)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {entry.provider ? PROVIDER_LABELS[entry.provider as ProviderName] ?? entry.provider : "—"}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-ink-muted)]">
            <span>
              Showing {rangeStart}–{rangeEnd} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => updateParams({ offset: String(Math.max(0, offset - LIMIT)) })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => updateParams({ offset: String(offset + LIMIT) })}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.event ?? "Log entry"} subtitle={selected ? formatDate(selected.timestamp) : undefined} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <LogLevelBadge level={selected.level} />
              {selected.provider && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
                  {PROVIDER_LABELS[selected.provider as ProviderName] ?? selected.provider}
                </span>
              )}
              {selected.scanId && (
                <Link to={`/scans/${selected.scanId}`} className="text-xs text-[var(--color-accent)] hover:underline">
                  Scan #{shortId(selected.scanId)}
                </Link>
              )}
              {selected.questionId && (
                <span className="text-xs text-[var(--color-ink-faint)]">Question {selected.questionId}</span>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Message</div>
              <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2.5 text-sm text-[var(--color-ink)]">
                {selected.message}
              </p>
            </div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Metadata</div>
                <pre className="max-h-72 overflow-auto rounded-lg border border-[var(--color-border)] bg-slate-900 px-3 py-2.5 text-xs text-slate-100">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
