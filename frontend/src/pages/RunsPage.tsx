import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { ScanStatusBadge } from "@/components/ui/StatusBadge";
import { FieldWrap, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { scanApi } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import { formatDate, formatDuration, SCAN_STATUS_LABELS } from "@/lib/format";
import type { ScanStatus, ScanSummary } from "@/lib/types";

const STATUS_OPTIONS: ScanStatus[] = ["pending", "running", "completed", "partial", "failed"];

function shortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

function runDurationMs(run: ScanSummary): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  return new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
}

/**
 * A "Run" is one scan execution — same underlying entity as /scans, but this view
 * is framed around pipeline execution (status, timing, request success/failure)
 * rather than the GEO-score/marketing framing that belongs on the Scans pages.
 */
export default function RunsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ScanStatus | "">("");
  const [businessId, setBusinessId] = useState("");
  const businessMap = useBusinessMap();

  const runsQuery = useQuery({
    queryKey: ["scans", { status, businessId, limit: 200 }],
    queryFn: () =>
      scanApi.list({
        status: status || undefined,
        businessId: businessId || undefined,
        limit: 200,
      }),
  });

  const runs = runsQuery.data ?? [];
  const hasFilters = !!status || !!businessId;
  const businesses = Object.values(businessMap.map).sort((a, b) => a.companyName.localeCompare(b.companyName));

  return (
    <div>
      <PageHeader
        title="Runs"
        subtitle="A run is one scan execution of the AI Query Engine pipeline — status, timing, and request outcomes."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <FieldWrap label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ScanStatus | "")}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SCAN_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
        <div className="w-64">
          <FieldWrap label="Business">
            <Select value={businessId} onChange={(e) => setBusinessId(e.target.value)} disabled={businessMap.isLoading}>
              <option value="">All businesses</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.companyName}
                </option>
              ))}
            </Select>
          </FieldWrap>
        </div>
      </div>

      {runsQuery.isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : runsQuery.isError ? (
        <ErrorState message="Could not load runs." onRetry={() => runsQuery.refetch()} />
      ) : runs.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No runs match your filters"
            description="Try a different status or business."
          />
        ) : (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No runs yet"
            description="Start a GEO scan to see its execution here."
          />
        )
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Run</Th>
              <Th>Business</Th>
              <Th>Status</Th>
              <Th>Started at</Th>
              <Th>Completed at</Th>
              <Th>Duration</Th>
              <Th>AI requests (ok / failed)</Th>
              <Th>Errors</Th>
            </Tr>
          </THead>
          <TBody>
            {runs.map((run) => (
              <Tr key={run.id} clickable onClick={() => navigate(`/runs/${run.id}`)}>
                <Td className="font-mono text-xs text-[var(--color-ink-muted)]" title={run.id}>
                  #{shortId(run.id)}
                </Td>
                <Td>{businessMap.map[run.businessId]?.companyName ?? "—"}</Td>
                <Td>
                  <ScanStatusBadge status={run.status} />
                </Td>
                <Td>{formatDate(run.startedAt)}</Td>
                <Td>{formatDate(run.completedAt)}</Td>
                <Td className="tabular-nums">{formatDuration(runDurationMs(run))}</Td>
                <Td className="tabular-nums">
                  {run.statistics ? (
                    <>
                      <span className="text-[var(--color-success)]">{run.statistics.successfulResponses}</span>
                      {" / "}
                      <span className={run.statistics.failedResponses > 0 ? "text-[var(--color-danger)]" : ""}>
                        {run.statistics.failedResponses}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="tabular-nums">{run.errors.length}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
