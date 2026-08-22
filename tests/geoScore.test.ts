import { describe, expect, it } from "vitest";
import { computeGeoScore, type GeoScoreInput } from "../src/services/scoring/geoScore.service.js";
import type { CrossModelAnalysis } from "../src/models/types.js";

const emptyCrossModel: CrossModelAnalysis = {
  perProvider: [],
  mentionRateSpread: 0,
  agreement: { mentionAgreementRate: 1 },
};

function baseInput(overrides: Partial<GeoScoreInput> = {}): GeoScoreInput {
  return {
    overallMentionRate: 0,
    overallRecommendationRate: 0,
    averageRelativePosition: null,
    businessMentionCount: 0,
    competitors: [],
    crossModel: emptyCrossModel,
    totalValidQuestions: 10,
    totalProviders: 3,
    successfulResponses: 30,
    ...overrides,
  };
}

describe("GEO score", () => {
  it("is reproducible for identical input", () => {
    const input = baseInput({ overallMentionRate: 0.6, overallRecommendationRate: 0.3, businessMentionCount: 18 });
    const a = computeGeoScore(input);
    const b = computeGeoScore(input);
    expect(a.total).toBe(b.total);
    expect(a.breakdown).toEqual(b.breakdown);
  });

  it("scores 0 for a business with zero mentions and zero coverage", () => {
    const result = computeGeoScore(baseInput({ successfulResponses: 0, totalValidQuestions: 0 }));
    expect(result.total).toBe(0);
  });

  it("never invents a position score when the business was never ranked", () => {
    const result = computeGeoScore(baseInput({ overallMentionRate: 0.5, businessMentionCount: 15, averageRelativePosition: null }));
    expect(result.breakdown.positionScore).toBe(0);
  });

  it("rewards a higher (better) relative position with a higher score", () => {
    const good = computeGeoScore(baseInput({ averageRelativePosition: 0.1 }));
    const bad = computeGeoScore(baseInput({ averageRelativePosition: 0.9 }));
    expect(good.breakdown.positionScore).toBeGreaterThan(bad.breakdown.positionScore);
  });

  it("keeps the total within 0-100 for a maximal input", () => {
    const result = computeGeoScore(
      baseInput({
        overallMentionRate: 1,
        overallRecommendationRate: 1,
        averageRelativePosition: 0,
        businessMentionCount: 30,
        crossModel: { perProvider: [{ provider: "openai", totalQuestions: 10, successfulResponses: 10, failedResponses: 0, mentionRate: 1, averagePosition: 1, recommendationRate: 1, uniqueCompetitorsSeen: 0 }], mentionRateSpread: 0, agreement: { mentionAgreementRate: 1 } },
      }),
    );
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.total).toBeGreaterThan(90);
  });

  it("penalizes competitor visibility when rivals dominate the responses", () => {
    const dominated = computeGeoScore(
      baseInput({ overallMentionRate: 0.3, businessMentionCount: 9, competitors: [{ name: "Rival", mentions: 50, averagePosition: 1, providers: {}, questionIds: [], categories: [] }] }),
    );
    const uncontested = computeGeoScore(baseInput({ overallMentionRate: 0.3, businessMentionCount: 9, competitors: [] }));
    expect(dominated.breakdown.competitorVisibilityScore).toBeLessThan(uncontested.breakdown.competitorVisibilityScore);
  });

  it("documents the weights used and they sum to 1", () => {
    const result = computeGeoScore(baseInput());
    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});
