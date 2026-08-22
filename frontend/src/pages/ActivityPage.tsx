import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Radio, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { logApi, scanApi } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import { formatDate, formatRelative, PROVIDER_LABELS } from "@/lib/format";
import type { LogEntry, LogLevel, ProviderName, ScanSummary } from "@/lib/types";

/**
 * Curated, human-readable feed of notable milestones — a strict subset of the real
 * event names actually emitted by the backend (grepped from src/logging call sites
 * across services/, queue/, providers/). Debug-level chatter (ai_request_started,
 * response_analyzed) and the process-level server_started event are excluded on
 * purpose so this reads as "what happened in the business", not a firehose —
 * that firehose is /logs.
 */
const NOTABLE_EVENTS = new Set<string>([
  "business_created",
  "business_research_completed",
  "business_research_ai_augment_failed",
  "scan_created",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "scan_not_found",
  "scan_unhandled_error",
  "stage_error",
  "questions_generated",
  "question_validation_dropped",
  "question_generation_shortfall",
  "ai_request_failed",
  "provider_not_configured",
  "api_unhandled_error",
]);

const LEVEL_ICON: Record<LogLevel, { icon: typeof Info; className: string }> = {
  DEBUG: { icon: Info, className: "bg-[var(--color-neutral-soft)] text-[var(--color-ink-muted)]" },
  INFO: { icon: Info, className: "bg-[var(--color-running-soft)] text-[var(--color-running)]" },
  SUCCESS: { icon: CheckCircle2, className: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  WARNING: { icon: AlertTriangle, className: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  ERROR: { icon: XCircle, className: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" },
};

function shortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

export default function ActivityPage() {
  const businessMap = useBusinessMap();

  const scansQuery = useQuery({ queryKey: ["scans", "picker", 200], queryFn: () => scanApi.list({ limit: 200 }) });
  const scanMap = useMemo(() => {
    const map: Record<string, ScanSummary> = {};
    for (const s of scansQuery.data ?? []) map[s.id] = s;
    return map;
  }, [scansQuery.data]);

  const logsQuery = useQuery({
    queryKey: ["logs", "activity", 200],
    queryFn: () => logApi.query({ order: "desc", limit: 200 }),
  });

  const activity: LogEntry[] = (logsQuery.data?.entries ?? []).filter((e) => NOTABLE_EVENTS.has(e.event));

  return (
    <div>
      <PageHeader title="Activity" subtitle="A curated feed of notable milestones — business, scan, and pipeline events. For the full firehose, see Logs." />

      {logsQuery.isLoading ? (
        <SkeletonTable rows={10} cols={2} />
      ) : logsQuery.isError ? (
        <ErrorState message="Could not load activity." onRetry={() => logsQuery.refetch()} />
      ) : activity.length === 0 ? (
        <EmptyState icon={<Radio className="h-5 w-5" />} title="No activity yet" description="Notable events — businesses added, scans run, milestones reached — will appear here." />
      ) : (
        <ol className="relative space-y-0 border-l border-[var(--color-border)] pl-6">
          {activity.map((entry) => {
            const scan = entry.scanId ? scanMap[entry.scanId] : undefined;
            const business = scan ? businessMap.map[scan.businessId] : undefined;
            const { icon: Icon, className } = LEVEL_ICON[entry.level] ?? LEVEL_ICON.INFO;
            return (
              <li key={entry.id ?? `${entry.timestamp}-${entry.event}`} className="relative pb-6 last:pb-0">
                <span className={`absolute -left-[41px] top-0 flex h-6 w-6 items-center justify-center rounded-full ${className}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                  <span title={formatDate(entry.timestamp)}>{formatRelative(entry.timestamp)}</span>
                  {entry.provider && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-[var(--color-ink-muted)]">
                      {PROVIDER_LABELS[entry.provider as ProviderName] ?? entry.provider}
                    </span>
                  )}
                  {entry.scanId && (
                    <Link to={`/runs/${entry.scanId}`} className="font-mono text-[var(--color-accent)] hover:underline">
                      run #{shortId(entry.scanId)}
                    </Link>
                  )}
                  {business && (
                    <Link to={`/businesses/${business.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {business.companyName}
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--color-ink)]">{entry.message}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
