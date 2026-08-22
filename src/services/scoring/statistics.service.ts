import type { AIResponse, CompetitorAggregate, CrossModelAnalysis, GeneratedQuestion, ResponseAnalysis, ScanStatistics } from "../../models/types.js";

/**
 * Aggregates raw scan output into the summary numbers section 24 asks for. Pure
 * function over already-computed responses/analyses/competitors/cross-model data.
 */
export function computeStatistics(
  questions: GeneratedQuestion[],
  responses: AIResponse[],
  analyses: ResponseAnalysis[],
  competitors: CompetitorAggregate[],
  crossModel: CrossModelAnalysis,
  geoScoreTotal: number | null,
  startedAt: string | null,
  completedAt: string | null,
): ScanStatistics {
  const successfulResponses = responses.filter((r) => r.status === "success").length;
  const failedResponses = responses.filter((r) => r.status === "failed").length;
  const mentioned = analyses.filter((a) => a.mention.mentioned).length;
  const notMentioned = analyses.length - mentioned;

  const positions = analyses
    .filter((a) => a.mention.mentioned && a.position.hasRanking && a.position.position !== null)
    .map((a) => a.position.position as number);
  const averagePosition = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

  const estimatedCostUsd = responses.reduce((sum, r) => sum + (r.usage.estimatedCostUsd ?? 0), 0);

  const durationMs = startedAt && completedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : null;

  return {
    totalQuestions: questions.length,
    totalResponses: responses.length,
    successfulResponses,
    failedResponses,
    mentioned,
    notMentioned,
    averagePosition,
    topCompetitors: competitors.slice(0, 10),
    providerPerformance: crossModel.perProvider,
    geoScore: geoScoreTotal,
    estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    durationMs,
  };
}
