import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, Radar, Activity as ActivityIcon, CheckCircle2, XCircle, Gauge, AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SkeletonStatRow, SkeletonTable, Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScansTable } from "@/components/scan/ScansTable";
import { LogLevelBadge } from "@/components/ui/StatusBadge";
import { businessApi, scanApi, logApi } from "@/lib/api";
import { useBusinessMap } from "@/hooks/useBusinessMap";
import { formatPercent, formatRelative, PROVIDER_LABELS, truncate } from "@/lib/format";
import type { ProviderName, ProviderPerformance } from "@/lib/types";

export default function OverviewPage() {
  const businessesQuery = useQuery({ queryKey: ["businesses"], queryFn: businessApi.list });
  const scansQuery = useQuery({ queryKey: ["scans", { limit: 500 }], queryFn: () => scanApi.list({ limit: 500 }) });
  const activityQuery = useQuery({ queryKey: ["logs", { order: "desc", limit: 8 }], queryFn: () => logApi.query({ order: "desc", limit: 8 }) });
  const errorsQuery = useQuery({ queryKey: ["logs", { level: "ERROR", limit: 5 }], queryFn: () => logApi.query({ level: "ERROR", order: "desc", limit: 5 }) });
  const businessMap = useBusinessMap();

  const scans = scansQuery.data ?? [];
  const running = scans.filter((s) => s.status === "running" || s.status === "pending").length;
  const completed = scans.filter((s) => s.status === "completed").length;
  const failed = scans.filter((s) => s.status === "failed").length;
  const scored = scans.filter((s) => s.geoScore !== null);
  const avgScore = scored.length > 0 ? scored.reduce((sum, s) => sum + (s.geoScore?.total ?? 0), 0) / scored.length : null;

  const providerRows = useMemo(() => buildProviderAggregate(scans.map((s) => s.statistics?.providerPerformance ?? [])), [scans]);

  const recentScans = [...scans]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const loading = businessesQuery.isLoading || scansQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="What's happening across your GEO scans right now." />

      {loading ? (
        <SkeletonStatRow count={6} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Businesses" value={businessesQuery.data?.length ?? 0} icon={<Building2 className="h-4 w-4" />} />
          <StatCard label="Total scans" value={scans.length} icon={<Radar className="h-4 w-4" />} />
          <StatCard label="Running" value={running} icon={<ActivityIcon className="h-4 w-4" />} tone={running > 0 ? "accent" : "neutral"} />
          <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
          <StatCard label="Failed" value={failed} icon={<XCircle className="h-4 w-4" />} tone={failed > 0 ? "danger" : "neutral"} />
          <StatCard label="Avg. GEO score" value={avgScore === null ? "—" : Math.round(avgScore)} icon={<Gauge className="h-4 w-4" />} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent scans" action={<Link to="/scans" className="text-xs font-medium text-[var(--color-accent)] hover:underline">View all</Link>} />
          <CardBody>
            {scansQuery.isLoading ? (
              <SkeletonTable rows={5} cols={5} />
            ) : scansQuery.isError ? (
              <ErrorState message="Could not load scans." onRetry={() => scansQuery.refetch()} />
            ) : recentScans.length === 0 ? (
              <EmptyState icon={<Radar className="h-5 w-5" />} title="No scans yet" description="Start your first GEO scan to see it here." />
            ) : (
              <ScansTable scans={recentScans} businessMap={businessMap.map} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" action={<Link to="/activity" className="text-xs font-medium text-[var(--color-accent)] hover:underline">View all</Link>} />
          <CardBody>
            {activityQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (activityQuery.data?.entries.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activityQuery.data!.entries.map((e) => (
                  <li key={e.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <LogLevelBadge level={e.level} />
                      <span className="text-xs text-[var(--color-ink-faint)]">{formatRelative(e.timestamp)}</span>
                    </div>
                    <p className="mt-0.5 text-[var(--color-ink)]">{truncate(e.message, 90)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Provider overview" subtitle="Aggregated across every scored scan." />
          <CardBody>
            {providerRows.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">No provider data yet — run a scan to populate this.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {providerRows.map((p) => (
                  <div key={p.provider} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="text-sm font-semibold text-[var(--color-ink)]">{PROVIDER_LABELS[p.provider]}</div>
                    <dl className="mt-2 space-y-1 text-xs text-[var(--color-ink-muted)]">
                      <div className="flex justify-between">
                        <dt>Responses</dt>
                        <dd className="font-medium text-[var(--color-ink)]">{p.totalResponses}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Mention rate</dt>
                        <dd className="font-medium text-[var(--color-ink)]">{formatPercent(p.mentionRate)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Avg. position</dt>
                        <dd className="font-medium text-[var(--color-ink)]">{p.avgPosition === null ? "—" : p.avgPosition.toFixed(1)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent errors" action={<Link to="/errors" className="text-xs font-medium text-[var(--color-accent)] hover:underline">View all</Link>} />
          <CardBody>
            {errorsQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (errorsQuery.data?.entries.length ?? 0) === 0 ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-success)]">
                <CheckCircle2 className="h-4 w-4" /> No recent errors.
              </div>
            ) : (
              <ul className="space-y-3">
                {errorsQuery.data!.entries.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm">
                    <AlertOctagon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--color-danger)]" />
                    <div>
                      <p className="text-[var(--color-ink)]">{truncate(e.message, 80)}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{formatRelative(e.timestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

interface ProviderAggregateRow {
  provider: ProviderName;
  totalResponses: number;
  mentionRate: number;
  avgPosition: number | null;
}

function buildProviderAggregate(perScan: ProviderPerformance[][]): ProviderAggregateRow[] {
  const totals = new Map<ProviderName, { responses: number; mentioned: number; positions: number[] }>();

  for (const providers of perScan) {
    for (const p of providers) {
      const entry = totals.get(p.provider) ?? { responses: 0, mentioned: 0, positions: [] };
      entry.responses += p.successfulResponses;
      entry.mentioned += Math.round(p.mentionRate * p.successfulResponses);
      if (p.averagePosition !== null) entry.positions.push(p.averagePosition);
      totals.set(p.provider, entry);
    }
  }

  return Array.from(totals.entries())
    .map(([provider, t]) => ({
      provider,
      totalResponses: t.responses,
      mentionRate: t.responses > 0 ? t.mentioned / t.responses : 0,
      avgPosition: t.positions.length > 0 ? t.positions.reduce((a, b) => a + b, 0) / t.positions.length : null,
    }))
    .sort((a, b) => b.totalResponses - a.totalResponses);
}
