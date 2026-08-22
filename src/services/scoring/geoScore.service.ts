import type { CompetitorAggregate, CrossModelAnalysis, GeoScore, GeoScoreBreakdown } from "../../models/types.js";

/**
 * Weights for each GEO score component. Together they must sum to 1. Kept as a
 * single exported constant (not buried in the formula) so the weighting can be
 * retuned later without touching the calculation logic itself (section 17).
 */
export const GEO_SCORE_WEIGHTS: GeoScoreBreakdown = {
  mentionRateScore: 0.3,
  positionScore: 0.2,
  recommendationScore: 0.2,
  competitorVisibilityScore: 0.1,
  crossModelVisibilityScore: 0.1,
  queryCoverageScore: 0.1,
};

export interface GeoScoreInput {
  /** mentioned / successfulResponses, across all providers combined. */
  overallMentionRate: number;
  /** recommended / successfulResponses, across all providers combined. */
  overallRecommendationRate: number;
  /** Average of (position / totalCompaniesMentioned) for responses that had both a ranking and a mention. Null if none did. */
  averageRelativePosition: number | null;
  /** How many successful responses actually mentioned the business. */
  businessMentionCount: number;
  competitors: CompetitorAggregate[];
  crossModel: CrossModelAnalysis;
  totalValidQuestions: number;
  totalProviders: number;
  successfulResponses: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Computes the 0-100 GEO score from already-aggregated scan data. Every component
 * is a pure, documented function of its input — no randomness, so the same scan
 * data always reproduces the same score (testable per section 17/33).
 *
 * Components:
 *  1. mentionRateScore        = overallMentionRate * 100
 *  2. positionScore           = 100 * (1 - averageRelativePosition); 0 if never ranked
 *  3. recommendationScore     = overallRecommendationRate * 100
 *  4. competitorVisibilityScore = business's share of voice vs. all detected competitors
 *  5. crossModelVisibilityScore = average per-provider mention rate, penalized for cross-model spread
 *  6. queryCoverageScore      = successful responses / (valid questions * providers queried)
 */
export function computeGeoScore(input: GeoScoreInput): GeoScore {
  const mentionRateScore = clamp(input.overallMentionRate * 100);

  const positionScore = input.averageRelativePosition === null ? 0 : clamp(100 * (1 - input.averageRelativePosition));

  const recommendationScore = clamp(input.overallRecommendationRate * 100);

  const totalCompetitorMentions = input.competitors.reduce((sum, c) => sum + c.mentions, 0);
  const voiceTotal = input.businessMentionCount + totalCompetitorMentions;
  const competitorVisibilityScore = voiceTotal === 0 ? 0 : clamp((input.businessMentionCount / voiceTotal) * 100);

  const providerRates = input.crossModel.perProvider
    .filter((p) => p.totalQuestions > 0)
    .map((p) => p.mentionRate);
  const avgProviderMentionRate = providerRates.length > 0 ? providerRates.reduce((a, b) => a + b, 0) / providerRates.length : 0;
  const crossModelVisibilityScore = clamp(avgProviderMentionRate * 100 - input.crossModel.mentionRateSpread * 50);

  const totalPossibleResponses = input.totalValidQuestions * input.totalProviders;
  const queryCoverageScore = totalPossibleResponses === 0 ? 0 : clamp((input.successfulResponses / totalPossibleResponses) * 100);

  const breakdown: GeoScoreBreakdown = {
    mentionRateScore,
    positionScore,
    recommendationScore,
    competitorVisibilityScore,
    crossModelVisibilityScore,
    queryCoverageScore,
  };

  const total = clamp(
    Object.entries(breakdown).reduce((sum, [key, value]) => sum + value * GEO_SCORE_WEIGHTS[key as keyof GeoScoreBreakdown], 0),
  );

  const explanation = [
    `GEO score = weighted sum of 6 components (0-100 each):`,
    `mention rate (${Math.round(GEO_SCORE_WEIGHTS.mentionRateScore * 100)}%), `,
    `position (${Math.round(GEO_SCORE_WEIGHTS.positionScore * 100)}%), `,
    `recommendation rate (${Math.round(GEO_SCORE_WEIGHTS.recommendationScore * 100)}%), `,
    `competitor visibility / share of voice (${Math.round(GEO_SCORE_WEIGHTS.competitorVisibilityScore * 100)}%), `,
    `cross-model visibility (${Math.round(GEO_SCORE_WEIGHTS.crossModelVisibilityScore * 100)}%), `,
    `query coverage (${Math.round(GEO_SCORE_WEIGHTS.queryCoverageScore * 100)}%).`,
  ].join("");

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
    weights: { ...GEO_SCORE_WEIGHTS },
    explanation,
  };
}
