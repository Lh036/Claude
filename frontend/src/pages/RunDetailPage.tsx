import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ScanStatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { RunTimeline } from "@/components/scan/RunTimeline";
import { scanApi, ApiError } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import { useScanStatus, isScanActive } from "@/hooks/useScanStatus";
import { formatDate, formatDuration, PROVIDER_LABELS } from "@/lib/format";

function StatBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</div>
      <div className="mt-1.5 text-sm font-semibold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const businessMap = useBusinessMap();

  const scanQuery = useQuery({
    queryKey: ["scan", id],
    queryFn: () => scanApi.get(id as string),
    enabled: !!id,
  });

  // Polls while pending/running so the header and timeline stay live for an active run.
  const statusQuery = useScanStatus(id);

  const status = statusQuery.data?.status ?? scanQuery.data?.status;
  const startedAt = statusQuery.data?.startedAt ?? scanQuery.data?.startedAt;
  const completedAt = statusQuery.data?.completedAt ?? scanQuery.data?.completedAt;
  const errors = statusQuery.data?.errors ?? scanQuery.data?.errors ?? [];

  if (!id) {
    return <ErrorState message="No run id was provided." />;
  }

  if (scanQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (scanQuery.isError) {
    const notFound = scanQuery.error instanceof ApiError && scanQuery.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Run not found" : "Something went wrong"}
        message={notFound ? "This run could not be found — it may have been deleted." : "Could not load this run."}
        onRetry={() => scanQuery.refetch()}
      />
    );
  }

  const scan = scanQuery.data;
  if (!scan) return null;

  const business = businessMap.map[scan.businessId];
  const duration = startedAt && completedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : null;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {business?.companyName ?? "Unknown business"}
            <span className="font-mono text-sm font-normal text-[var(--color-ink-faint)]" title={scan.id}>
              #{scan.id.slice(-8)}
            </span>
          </span>
        }
        subtitle="A run is one scan execution of the AI Query Engine pipeline."
        actions={
          <Link to={`/scans/${scan.id}`}>
            <Button variant="secondary" icon={<ArrowRight className="h-3.5 w-3.5" />}>
              View full scan results
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="Status" value={status ? <ScanStatusBadge status={status} /> : "—"} />
        <StatBlock label="Started at" value={formatDate(startedAt)} />
        <StatBlock label="Completed at" value={formatDate(completedAt)} />
        <StatBlock label="Duration" value={formatDuration(duration)} />
      </div>

      {errors.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Errors" subtitle={`${errors.length} error${errors.length === 1 ? "" : "s"} recorded during this run`} />
          <CardBody className="space-y-3">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/40 px-3 py-2.5 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-danger)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--color-ink)]">{err.message}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    {err.stage}
                    {err.provider && ` · ${PROVIDER_LABELS[err.provider]}`}
                    {" · "}
                    {formatDate(err.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Timeline" subtitle="Real execution events for this run, in order." />
        <CardBody>
          <RunTimeline scanId={scan.id} live={isScanActive(status)} />
        </CardBody>
      </Card>
    </div>
  );
}
