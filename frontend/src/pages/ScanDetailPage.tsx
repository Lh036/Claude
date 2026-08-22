import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Calendar, Clock, ExternalLink, Radar } from "lucide-react";
import { scanApi, ApiError } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonStatRow, SkeletonTable } from "@/components/ui/Skeleton";
import { ScanStatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { ScanProgress } from "@/components/scan/ScanProgress";
import { ScoreGauge } from "@/components/scan/ScoreGauge";
import { VisibilityPanel } from "@/components/scan/VisibilityPanel";
import { QuestionsPanel } from "@/components/scan/QuestionsPanel";
import { ResponsesPanel } from "@/components/scan/ResponsesPanel";
import { CompetitorsTable } from "@/components/scan/CompetitorsTable";
import { RecommendationsList } from "@/components/scan/RecommendationsList";
import { ProviderComparisonTable, ProviderMentionChart } from "@/components/scan/ProviderComparison";
import { RunTimeline } from "@/components/scan/RunTimeline";
import { ScanErrorsPanel } from "@/components/scan/ScanErrorsPanel";
import { formatCost, formatDate, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { isScanActive } from "@/hooks/useScanStatus";
import type { CompetitorAggregate, CrossModelAnalysis, GeoScore, Recommendation, ScanStatistics } from "@/lib/types";

export default function ScanDetailPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState("overview");
  const [questionFilter, setQuestionFilter] = useState("");

  const query = useQuery({
    queryKey: ["scanResult", id],
    queryFn: () => scanApi.result(id),
    enabled: !!id,
    refetchInterval: (q) => (isScanActive(q.state.data?.scan.status) ? 2000 : false),
  });

  const tabs: TabItem[] = useMemo(() => {
    const d = query.data;
    return [
      { key: "overview", label: "Overview" },
      { key: "questions", label: "Questions", count: d?.questions.length },
      { key: "responses", label: "AI Responses", count: d?.responses.length },
      { key: "visibility", label: "Visibility" },
      { key: "competitors", label: "Competitors", count: d?.competitors.length },
      { key: "providers", label: "Providers", count: d?.crossModel?.perProvider.length },
      { key: "recommendations", label: "Recommendations", count: d?.recommendations.length },
      { key: "runs", label: "Runs & Logs" },
      { key: "errors", label: "Errors", count: d?.errors.length },
    ];
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <SkeletonStatRow count={6} />
        <SkeletonTable rows={6} cols={6} />
      </div>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Scan not found" : "Could not load this scan"}
        message={notFound ? `No scan exists with id "${id}".` : (query.error as Error).message}
        onRetry={notFound ? undefined : () => query.refetch()}
      />
    );
  }

  const result = query.data!;
  const { scan, business, statistics, geoScore, crossModel, analyses, competitors, recommendations, questions, responses, errors } = result;
  const active = isScanActive(scan.status);

  function goToResponses(questionId: string) {
    setQuestionFilter(questionId);
    setTab("responses");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/scans" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          <ArrowLeft className="h-3.5 w-3.5" /> All scans
        </Link>

        <Card>
          <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/businesses/${business.id}`} className="flex items-center gap-1.5 text-lg font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                  <Building2 className="h-4 w-4 text-[var(--color-ink-faint)]" />
                  {business.companyName}
                </Link>
                <ScanStatusBadge status={scan.status} />
              </div>
              {business.website && (
                <a href={business.website} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]">
                  {business.website} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[var(--color-ink-muted)]">
                <span className="font-mono">{scan.id}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Started {formatDate(scan.startedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Duration {formatDuration(statistics?.durationMs ?? null)}
                </span>
              </div>
            </div>
            <ScoreGauge score={geoScore?.total ?? null} size={96} />
          </CardBody>
        </Card>
      </div>

      {active && (
        <Card>
          <CardHeader title="Live scan progress" subtitle="Updates automatically — no need to refresh." />
          <CardBody>
            <ScanProgress scan={scan} hasStatistics={!!statistics} />
          </CardBody>
        </Card>
      )}

      {statistics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Questions" value={formatNumber(statistics.totalQuestions)} icon={<Radar className="h-4 w-4" />} />
          <StatCard label="Responses" value={formatNumber(statistics.totalResponses)} />
          <StatCard
            label="Successful"
            value={formatNumber(statistics.successfulResponses)}
            tone="success"
          />
          <StatCard
            label="Failed"
            value={formatNumber(statistics.failedResponses)}
            tone={statistics.failedResponses > 0 ? "danger" : "neutral"}
          />
          <StatCard label="Mention rate" value={formatPercent(statistics.successfulResponses > 0 ? statistics.mentioned / statistics.successfulResponses : null)} tone="accent" />
          <StatCard label="Est. cost" value={formatCost(statistics.estimatedCostUsd)} hint="from real token usage" />
        </div>
      )}

      <div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="pt-5">
          {tab === "overview" && (
            <OverviewTab
              geoScore={geoScore}
              statistics={statistics}
              crossModel={crossModel}
              competitors={competitors}
              recommendations={recommendations}
            />
          )}
          {tab === "questions" && <QuestionsPanel questions={questions} onViewResponses={goToResponses} />}
          {tab === "responses" && (
            <ResponsesPanel
              responses={responses}
              analyses={analyses}
              questions={questions}
              questionFilter={questionFilter}
              onQuestionFilterChange={setQuestionFilter}
            />
          )}
          {tab === "visibility" &&
            (statistics ? (
              <VisibilityPanel statistics={statistics} crossModel={crossModel} analyses={analyses} />
            ) : (
              <EmptyStatePlaceholder />
            ))}
          {tab === "competitors" && <CompetitorsTable competitors={competitors} />}
          {tab === "providers" && (crossModel ? <ProviderComparisonTable perProvider={crossModel.perProvider} /> : <EmptyStatePlaceholder />)}
          {tab === "recommendations" && <RecommendationsList recommendations={recommendations} />}
          {tab === "runs" && <RunTimeline scanId={scan.id} live={active} />}
          {tab === "errors" && <ScanErrorsPanel errors={errors} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  geoScore,
  statistics,
  crossModel,
  competitors,
  recommendations,
}: {
  geoScore: GeoScore | null;
  statistics: ScanStatistics | null;
  crossModel: CrossModelAnalysis | null;
  competitors: CompetitorAggregate[];
  recommendations: Recommendation[];
}) {
  if (!statistics || !geoScore) {
    return <EmptyStatePlaceholder />;
  }

  const sortedProviders = [...(crossModel?.perProvider ?? [])].sort((a, b) => b.mentionRate - a.mentionRate);
  const best = sortedProviders[0];
  const worst = sortedProviders[sortedProviders.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="GEO Score breakdown" subtitle={geoScore.explanation} />
          <CardBody className="space-y-2 text-sm">
            {Object.entries(geoScore.breakdown).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="capitalize text-[var(--color-ink-muted)]">{key.replace(/Score$/, "").replace(/([A-Z])/g, " $1")}</span>
                <span className="font-medium tabular-nums text-[var(--color-ink)]">{Math.round(value)}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Visibility by provider" />
          <CardBody>
            {crossModel && crossModel.perProvider.length > 0 ? (
              <>
                <ProviderMentionChart perProvider={crossModel.perProvider} />
                {best && worst && best.provider !== worst.provider && (
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                    Best visibility: <span className="font-medium text-[var(--color-ink)]">{best.provider}</span> ({formatPercent(best.mentionRate)}) · Lowest:{" "}
                    <span className="font-medium text-[var(--color-ink)]">{worst.provider}</span> ({formatPercent(worst.mentionRate)})
                  </p>
                )}
              </>
            ) : (
              <EmptyStatePlaceholder />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top competitors" subtitle="Most-mentioned companies detected in this scan." />
          <CardBody>
            {competitors.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">No competitors detected.</p>
            ) : (
              <ul className="space-y-2">
                {competitors.slice(0, 5).map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{c.name}</span>
                    <span className="text-[var(--color-ink-muted)]">{c.mentions} mentions</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Key recommendations" />
          <CardBody>
            {recommendations.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">No recommendations generated.</p>
            ) : (
              <RecommendationsList recommendations={recommendations.slice(0, 2)} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function EmptyStatePlaceholder() {
  return <p className="rounded-xl border border-dashed border-[var(--color-border-strong)] bg-white px-4 py-10 text-center text-sm text-[var(--color-ink-muted)]">Not available yet — this becomes available once the scan finishes scoring.</p>;
}
