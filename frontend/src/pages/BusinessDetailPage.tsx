import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, MapPin, Factory, Rocket, Radar } from "lucide-react";
import { businessApi, scanApi, ApiError } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonStatRow } from "@/components/ui/Skeleton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { ScoreGauge } from "@/components/scan/ScoreGauge";
import { ScansTable } from "@/components/scan/ScansTable";
import { VisibilityPanel } from "@/components/scan/VisibilityPanel";
import { CompetitorsTable } from "@/components/scan/CompetitorsTable";
import { RecommendationsList } from "@/components/scan/RecommendationsList";
import { StartScanModal } from "@/components/scan/StartScanModal";
import { formatDate } from "@/lib/format";

export default function BusinessDetailPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState("overview");
  const [startScanOpen, setStartScanOpen] = useState(false);

  const businessQuery = useQuery({ queryKey: ["business", id], queryFn: () => businessApi.get(id), enabled: !!id });
  const scansQuery = useQuery({ queryKey: ["businessScans", id], queryFn: () => scanApi.list({ businessId: id, limit: 200 }), enabled: !!id });

  const latestWithStats = useMemo(() => scansQuery.data?.find((s) => s.statistics) ?? null, [scansQuery.data]);
  const latestScanId = latestWithStats?.id;
  const scanResultQuery = useQuery({
    queryKey: ["scanResult", latestScanId],
    queryFn: () => scanApi.result(latestScanId as string),
    enabled: !!latestScanId,
  });

  if (businessQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <SkeletonStatRow />
      </div>
    );
  }

  if (businessQuery.isError || !businessQuery.data) {
    const notFound = businessQuery.error instanceof ApiError && businessQuery.error.status === 404;
    return <ErrorState title={notFound ? "Business not found" : "Could not load business"} message={notFound ? `No business exists with id "${id}".` : (businessQuery.error as Error)?.message ?? ""} />;
  }

  const business = businessQuery.data;
  const scans = scansQuery.data ?? [];
  const result = scanResultQuery.data;

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview" },
    { key: "scans", label: "Scans", count: scans.length },
    { key: "visibility", label: "Visibility" },
    { key: "competitors", label: "Competitors", count: result?.competitors.length },
    { key: "recommendations", label: "Recommendations", count: result?.recommendations.length },
  ];

  return (
    <div className="space-y-6">
      <Link to="/businesses" className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-3.5 w-3.5" /> All businesses
      </Link>

      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--color-ink)]">{business.companyName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-ink-muted)]">
              {business.website && (
                <a href={business.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[var(--color-accent)]">
                  {business.website} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {business.industry && (
                <span className="flex items-center gap-1">
                  <Factory className="h-3.5 w-3.5" /> {business.industry}
                </span>
              )}
              {business.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {business.location}
                </span>
              )}
            </div>
            {business.description && <p className="mt-3 max-w-2xl text-sm text-[var(--color-ink-muted)]">{business.description}</p>}
            {latestWithStats && (
              <p className="mt-3 text-xs text-[var(--color-ink-faint)]">Last scan: {formatDate(latestWithStats.createdAt)}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-center gap-3">
            {latestWithStats?.geoScore && <ScoreGauge score={latestWithStats.geoScore.total} size={88} />}
            <Button icon={<Rocket className="h-4 w-4" />} onClick={() => setStartScanOpen(true)}>
              Start new scan
            </Button>
          </div>
        </CardBody>
      </Card>

      <div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="pt-5">
          {tab === "overview" &&
            (result && result.statistics && result.geoScore ? (
              <div className="space-y-5">
                <VisibilityPanel statistics={result.statistics} crossModel={result.crossModel} analyses={result.analyses} />
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Card>
                    <CardHeader title="Top competitors" />
                    <CardBody>
                      {result.competitors.length === 0 ? (
                        <p className="text-sm text-[var(--color-ink-muted)]">No competitors detected.</p>
                      ) : (
                        <ul className="space-y-2">
                          {result.competitors.slice(0, 5).map((c) => (
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
                    <CardHeader title="Top recommendations" />
                    <CardBody>
                      <RecommendationsList recommendations={result.recommendations.slice(0, 2)} />
                    </CardBody>
                  </Card>
                </div>
                <Link to={`/scans/${latestScanId}`} className="inline-block text-sm font-medium text-[var(--color-accent)] hover:underline">
                  View full scan results →
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={<Radar className="h-5 w-5" />}
                title="No completed scans yet"
                description="Start a GEO scan to see visibility, competitors and recommendations for this business."
                action={
                  <Button size="sm" icon={<Rocket className="h-4 w-4" />} onClick={() => setStartScanOpen(true)}>
                    Start new scan
                  </Button>
                }
              />
            ))}

          {tab === "scans" && (
            <ScansTable
              scans={scans}
              emptyDescription="Start your first scan for this business to see it here."
            />
          )}

          {tab === "visibility" &&
            (result?.statistics ? (
              <VisibilityPanel statistics={result.statistics} crossModel={result.crossModel} analyses={result.analyses} />
            ) : (
              <EmptyState icon={<Radar className="h-5 w-5" />} title="No visibility data yet" />
            ))}

          {tab === "competitors" && <CompetitorsTable competitors={result?.competitors ?? []} />}

          {tab === "recommendations" && <RecommendationsList recommendations={result?.recommendations ?? []} />}
        </div>
      </div>

      <StartScanModal open={startScanOpen} onClose={() => setStartScanOpen(false)} initialBusinessId={business.id} />
    </div>
  );
}
