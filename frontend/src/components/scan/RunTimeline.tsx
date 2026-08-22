import { useQuery } from "@tanstack/react-query";
import { logApi } from "@/lib/api";
import { LogLevelBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatTime } from "@/lib/format";
import { History } from "lucide-react";
import { PROVIDER_LABELS } from "@/lib/format";
import type { ProviderName } from "@/lib/types";

/**
 * Renders the real execution timeline for one scan, sourced from the `logs`
 * table (GET /api/logs?scanId=...&order=asc) — every entry here is a genuine
 * event the backend emitted while running the pipeline (scan_started,
 * questions_generated, ai_request_completed, scan_completed, ...), not a
 * synthetic progress simulation.
 */
export function RunTimeline({ scanId, live = false }: { scanId: string; live?: boolean }) {
  const query = useQuery({
    queryKey: ["logs", { scanId, order: "asc" }],
    queryFn: () => logApi.query({ scanId, order: "asc", limit: 500 }),
    refetchInterval: live ? 2000 : false,
  });

  if (query.isLoading) return <SkeletonTable rows={8} cols={3} />;
  if (query.isError) {
    return <ErrorState message="Could not load the run timeline." onRetry={() => query.refetch()} />;
  }
  const entries = query.data?.entries ?? [];
  if (entries.length === 0) {
    return <EmptyState icon={<History className="h-5 w-5" />} title="No timeline events yet" description="Events will appear here as the run progresses." />;
  }

  return (
    <ol className="relative space-y-0 border-l border-[var(--color-border)] pl-5">
      {entries.map((entry) => (
        <li key={entry.id ?? `${entry.timestamp}-${entry.event}`} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--color-border-strong)]" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <span className="font-mono tabular-nums">{formatTime(entry.timestamp)}</span>
            <LogLevelBadge level={entry.level} />
            {entry.provider && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-[var(--color-ink-muted)]">
                {PROVIDER_LABELS[entry.provider as ProviderName] ?? entry.provider}
              </span>
            )}
            <span className="font-mono text-[var(--color-ink-faint)]">{entry.event}</span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--color-ink)]">{entry.message}</p>
        </li>
      ))}
    </ol>
  );
}
