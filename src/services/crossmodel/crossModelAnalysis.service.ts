import type { AIResponse, CrossModelAnalysis, ProviderName, ProviderPerformance, ResponseAnalysis } from "../../models/types.js";

/**
 * Compares mention rate, position, recommendation rate, and competitor sets
 * across ChatGPT/Gemini/Claude (section 16). Every metric is computed strictly
 * from stored responses/analyses for this scan — nothing is estimated.
 */
export function analyzeCrossModel(responses: AIResponse[], analyses: ResponseAnalysis[]): CrossModelAnalysis {
  const analysesByResponseId = new Map(analyses.map((a) => [a.responseId, a]));
  const providers = Array.from(new Set(responses.map((r) => r.provider)));

  const perProvider: ProviderPerformance[] = providers.map((provider) => {
    const providerResponses = responses.filter((r) => r.provider === provider);
    const successful = providerResponses.filter((r) => r.status === "success");
    const failed = providerResponses.filter((r) => r.status === "failed");
    const providerAnalyses = successful
      .map((r) => analysesByResponseId.get(r.id))
      .filter((a): a is ResponseAnalysis => !!a);

    const mentionedCount = providerAnalyses.filter((a) => a.mention.mentioned).length;
    const recommendedCount = providerAnalyses.filter((a) => a.mention.recommended).length;
    const rankedPositions = providerAnalyses
      .filter((a) => a.mention.mentioned && a.position.hasRanking && a.position.position !== null)
      .map((a) => a.position.position as number);

    const competitorNames = new Set<string>();
    for (const a of providerAnalyses) {
      for (const c of a.competitorsDetected) competitorNames.add(c.name.toLowerCase());
    }

    return {
      provider,
      totalQuestions: providerResponses.length,
      successfulResponses: successful.length,
      failedResponses: failed.length,
      mentionRate: successful.length > 0 ? mentionedCount / successful.length : 0,
      averagePosition: rankedPositions.length > 0 ? rankedPositions.reduce((a, b) => a + b, 0) / rankedPositions.length : null,
      recommendationRate: successful.length > 0 ? recommendedCount / successful.length : 0,
      uniqueCompetitorsSeen: competitorNames.size,
    };
  });

  const ratesWithData = perProvider.filter((p) => p.successfulResponses > 0).map((p) => p.mentionRate);
  const mentionRateSpread = ratesWithData.length > 0 ? Math.max(...ratesWithData) - Math.min(...ratesWithData) : 0;

  const mentionAgreementRate = computeMentionAgreementRate(responses, analysesByResponseId);

  return {
    perProvider,
    mentionRateSpread,
    agreement: { mentionAgreementRate },
  };
}

function computeMentionAgreementRate(
  responses: AIResponse[],
  analysesByResponseId: Map<string, ResponseAnalysis>,
): number {
  const byQuestion = new Map<string, Partial<Record<ProviderName, boolean>>>();

  for (const response of responses) {
    if (response.status !== "success") continue;
    const analysis = analysesByResponseId.get(response.id);
    if (!analysis) continue;
    const entry = byQuestion.get(response.questionId) ?? {};
    entry[response.provider] = analysis.mention.mentioned;
    byQuestion.set(response.questionId, entry);
  }

  let comparable = 0;
  let agreeing = 0;
  for (const outcomes of byQuestion.values()) {
    const values = Object.values(outcomes);
    if (values.length < 2) continue;
    comparable++;
    if (values.every((v) => v === values[0])) agreeing++;
  }

  // No question had 2+ provider responses to compare — nothing observed to disagree
  // on, so we report full agreement rather than an undefined/misleading 0.
  return comparable === 0 ? 1 : agreeing / comparable;
}
