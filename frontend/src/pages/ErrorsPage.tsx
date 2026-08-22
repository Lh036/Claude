import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { FieldWrap, Select, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { logApi, scanApi } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import { formatDate, PROVIDER_LABELS, truncate } from "@/lib/format";
import type { LogEntry, ProviderName, ScanSummary } from "@/lib/types";

const PROVIDER_OPTIONS = Object.keys(PROVIDER_LABELS) as ProviderName[];
const MESSAGE_PREVIEW_LEN = 140;

function shortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

function ErrorMessageCell({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > MESSAGE_PREVIEW_LEN;
  return (
    <div className="max-w-lg text-sm text-[var(--color-ink)]">
      <span className={expanded ? "whitespace-pre-wrap" : ""}>{expanded || !isLong ? message : truncate(message, MESSAGE_PREVIEW_LEN)}</span>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="ml-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * Errors are pulled from the same `logs` table as /logs (level=ERROR) — there is no
 * separate backend errors resource, and no fake "open/investigating/resolved"
 * workflow: this is a read-only, error-specific view over real data.
 */
export default function ErrorsPage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState("");
  const [scanId, setScanId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const businessMap = useBusinessMap();

  const scansQuery = useQuery({ queryKey: ["scans", "picker", 200], queryFn: () => scanApi.list({ limit: 200 }) });
  const scanMap = useMemo(() => {
    const map: Record<string, ScanSummary> = {};
    for (const s of scansQuery.data ?? []) map[s.id] = s;
    return map;
  }, [scansQuery.data]);

  const errorsQuery = useQuery({
    queryKey: ["logs", { level: "ERROR", provider, scanId, q: searchInput, order: "desc" }],
    queryFn: () =>
      logApi.query({
        level: "ERROR",
        provider: provider || undefined,
        scanId: scanId || undefined,
        q: searchInput || undefined,
        order: "desc",
        limit: 200,
      }),
  });

  const entries: LogEntry[] = errorsQuery.data?.entries ?? [];
  const hasFilters = !!provider || !!scanId || !!searchInput;

  return (
    <div>
      <PageHeader title="Errors" subtitle="Every ERROR-level event recorded across scans — sourced directly from the logs, no separate tracking." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <FieldWrap label="Provider">
            <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
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
            <Select value={scanId} onChange={(e) => setScanId(e.target.value)} disabled={scansQuery.isLoading}>
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
              <Input className="pl-8" placeholder="Search error message…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
          </FieldWrap>
        </div>
      </div>

      {errorsQuery.isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : errorsQuery.isError ? (
        <ErrorState message="Could not load errors." onRetry={() => errorsQuery.refetch()} />
      ) : entries.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="No errors match your filters" description="Try a different provider, scan, or search term." />
        ) : (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="No errors recorded"
            description="Every AI request and pipeline stage has completed without error."
          />
        )
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Timestamp</Th>
              <Th>Business / Scan</Th>
              <Th>Provider</Th>
              <Th>Event</Th>
              <Th>Message</Th>
            </Tr>
          </THead>
          <TBody>
            {entries.map((entry) => {
              const scan = entry.scanId ? scanMap[entry.scanId] : undefined;
              const business = scan ? businessMap.map[scan.businessId] : undefined;
              return (
                <Tr
                  key={entry.id ?? `${entry.timestamp}-${entry.event}`}
                  clickable={!!entry.scanId}
                  onClick={() => entry.scanId && navigate(`/scans/${entry.scanId}`)}
                >
                  <Td className="whitespace-nowrap font-mono text-xs text-[var(--color-ink-muted)]">{formatDate(entry.timestamp)}</Td>
                  <Td className="whitespace-nowrap text-sm">
                    {entry.scanId ? (
                      <div>
                        <div className="font-medium text-[var(--color-ink)]">{business?.companyName ?? "Unknown business"}</div>
                        <div className="font-mono text-xs text-[var(--color-ink-faint)]">#{shortId(entry.scanId)}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {entry.provider ? PROVIDER_LABELS[entry.provider as ProviderName] ?? entry.provider : "—"}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{entry.event}</Td>
                  <Td>
                    <ErrorMessageCell message={entry.message} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
