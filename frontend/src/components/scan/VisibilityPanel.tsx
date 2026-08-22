import { useMemo } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { ProviderMentionChart } from "./ProviderComparison";
import { formatOrdinal, formatPercent } from "@/lib/format";
import type { CrossModelAnalysis, ResponseAnalysis, ScanStatistics } from "@/lib/types";
import { Eye, EyeOff, TrendingUp, Target } from "lucide-react";

export function VisibilityPanel({
  statistics,
  crossModel,
  analyses,
}: {
  statistics: ScanStatistics;
  crossModel: CrossModelAnalysis | null;
  analyses: ResponseAnalysis[];
}) {
  const mentionRate = statistics.successfulResponses > 0 ? statistics.mentioned / statistics.successfulResponses : null;

  const rankedPositions = useMemo(
    () =>
      analyses
        .filter((a) => a.mention.mentioned && a.position.hasRanking && a.position.position !== null)
        .map((a) => a.position.position as number),
    [analyses],
  );
  const bestPosition = rankedPositions.length > 0 ? Math.min(...rankedPositions) : null;
  const worstPosition = rankedPositions.length > 0 ? Math.max(...rankedPositions) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Mention rate"
          value={formatPercent(mentionRate)}
          hint={`${statistics.mentioned} of ${statistics.successfulResponses} responses`}
          icon={<Eye className="h-4 w-4" />}
          tone="accent"
        />
        <StatCard
          label="Not mentioned"
          value={statistics.notMentioned}
          hint="successful responses"
          icon={<EyeOff className="h-4 w-4" />}
        />
        <StatCard
          label="Average position"
          value={statistics.averagePosition === null ? "—" : formatOrdinal(Math.round(statistics.averagePosition))}
          hint={statistics.averagePosition === null ? "No ranked mentions" : `across ${rankedPositions.length} ranked mentions`}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Best / worst position"
          value={bestPosition === null ? "—" : `${formatOrdinal(bestPosition)} / ${formatOrdinal(worstPosition ?? bestPosition)}`}
          hint="when a response contained a ranking"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {crossModel && crossModel.perProvider.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Mention rate by provider</h4>
          <ProviderMentionChart perProvider={crossModel.perProvider} />
        </div>
      )}

      {crossModel && crossModel.perProvider.length > 1 && (
        <p className="text-xs text-[var(--color-ink-muted)]">
          Cross-model mention agreement: <span className="font-medium text-[var(--color-ink)]">{formatPercent(crossModel.agreement.mentionAgreementRate)}</span>{" "}
          — how often providers agreed on whether the business was mentioned for the same question.
        </p>
      )}
    </div>
  );
}
