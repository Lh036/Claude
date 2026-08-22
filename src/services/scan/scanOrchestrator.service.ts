import { getBusiness } from "../../db/business.repository.js";
import { getScan, updateScan, saveScanResults } from "../../db/scan.repository.js";
import { saveQuestions } from "../../db/question.repository.js";
import { saveCompetitors } from "../../db/analysis.repository.js";
import { saveRecommendations } from "../../db/recommendation.repository.js";
import { researchBusiness, augmentResearchWithAi, persistResearch } from "../business/research.service.js";
import { generateQuestions } from "../questions/generator.service.js";
import { validateQuestions } from "../questions/validator.service.js";
import { buildProviders } from "../../providers/registry.js";
import { runAiQueries } from "../../queue/aiQueryQueue.js";
import { analyzeResponse } from "../analysis/responseAnalyzer.service.js";
import { aggregateCompetitors } from "../analysis/competitorDetection.service.js";
import { analyzeCrossModel } from "../crossmodel/crossModelAnalysis.service.js";
import { computeGeoScore } from "../scoring/geoScore.service.js";
import { computeStatistics } from "../scoring/statistics.service.js";
import { generateRecommendations } from "../recommendations/recommendation.service.js";
import { config } from "../../config/index.js";
import { logger } from "../../logging/logger.js";
import type { AIResponse, ResponseAnalysis, Scan, ScanError, ScanStage } from "../../models/types.js";

/**
 * Runs the full GEO pipeline (sections 1-26) for an existing, pending scan.
 * Every stage updates `scans.stage` so progress is observable via getScan(), and
 * every stage's failures are caught locally so one bad step degrades the scan to
 * "partial"/"failed" instead of throwing out of this function unhandled — the
 * caller (scanService) always gets a settled scan row, never an unhandled
 * rejection (sections 19-20).
 */
export async function runScan(scanId: string): Promise<void> {
  const scan = getScan(scanId);
  if (!scan) {
    logger.error("scan_not_found", `runScan called with unknown scan id`, { scanId });
    return;
  }

  const errors: ScanError[] = [...scan.errors];
  const startedAt = new Date().toISOString();
  updateScan(scanId, { status: "running", stage: "research", startedAt });
  logger.info("scan_started", `Scan started`, { scanId });

  const business = getBusiness(scan.businessId);
  if (!business) {
    fail(scanId, "research", `Business ${scan.businessId} not found`, errors);
    return;
  }

  try {
    // --- Business research -------------------------------------------------
    let research = researchBusiness(business);

    if (config().mode === "production") {
      const providers = buildProviders(scan.options.providers);
      const realProvider = providers.find((p) => p.name !== "mock" && p.isConfigured());
      if (realProvider) {
        research = await augmentResearchWithAi(business, research, async (prompt) => {
          const result = await realProvider.runQuery(prompt);
          if (result.status !== "success" || !result.answer) {
            throw new Error(result.error?.message ?? "AI research augmentation returned no answer");
          }
          return result.answer;
        });
        persistResearch(research);
      }
    }

    // --- Question generation + validation -----------------------------------
    updateScan(scanId, { stage: "question_generation" });
    const generated = generateQuestions(business, research, scanId, { count: scan.options.questionCount });

    updateScan(scanId, { stage: "question_validation" });
    const validated = validateQuestions(generated, business, research);
    saveQuestions(validated);
    const validQuestions = validated.filter((q) => q.valid);

    if (validQuestions.length === 0) {
      fail(scanId, "question_validation", "No valid questions could be generated for this business", errors);
      return;
    }

    // --- AI Query Engine ------------------------------------------------------
    updateScan(scanId, { stage: "ai_querying" });
    const providers = buildProviders(scan.options.providers);
    const { responses, errors: queryErrors } = await runAiQueries(scanId, validQuestions, providers);
    errors.push(...queryErrors);

    // --- Response analysis ------------------------------------------------
    updateScan(scanId, { stage: "response_analysis" });
    const questionsById = new Map(validated.map((q) => [q.id, q]));
    const analyses: ResponseAnalysis[] = [];
    for (const response of responses) {
      try {
        const question = questionsById.get(response.questionId);
        analyses.push(analyzeResponse(response, question?.location ?? business.location, research));
      } catch (err) {
        recordStageError(scanId, "response_analysis", errors, err, response.questionId, response.provider);
      }
    }

    // --- Competitor detection -----------------------------------------------
    updateScan(scanId, { stage: "competitor_detection" });
    const competitors = aggregateCompetitors(analyses, questionsById);
    saveCompetitors(scanId, competitors);

    // --- Cross-model analysis ------------------------------------------------
    updateScan(scanId, { stage: "cross_model_analysis" });
    const crossModel = analyzeCrossModel(responses, analyses);

    // --- Scoring --------------------------------------------------------------
    updateScan(scanId, { stage: "scoring" });
    const geoScore = computeGeoScore(buildGeoScoreInput(responses, analyses, competitors, crossModel, validQuestions.length, providers.length));

    // --- Statistics + recommendations -----------------------------------------
    updateScan(scanId, { stage: "recommendations" });
    const completedAt = new Date().toISOString();
    const statistics = computeStatistics(validated, responses, analyses, competitors, crossModel, geoScore.total, startedAt, completedAt);
    const recommendations = generateRecommendations(statistics, crossModel, competitors, analyses, questionsById, geoScore);
    saveRecommendations(scanId, recommendations);
    saveScanResults(scanId, { crossModel, geoScore, statistics });

    // --- Done -------------------------------------------------------------
    const status = errors.length === 0 ? "completed" : statistics.successfulResponses > 0 ? "partial" : "failed";
    updateScan(scanId, { status, stage: "done", completedAt, errors });
    logger.success("scan_completed", `Scan finished with status "${status}"`, { scanId }, {
      geoScore: geoScore.total,
      successfulResponses: statistics.successfulResponses,
      failedResponses: statistics.failedResponses,
    });
  } catch (err) {
    recordStageError(scanId, "done", errors, err);
    const current = getScan(scanId);
    const hasAnyResponses = (current?.stage ?? "created") !== "created";
    updateScan(scanId, { status: hasAnyResponses ? "partial" : "failed", stage: "done", completedAt: new Date().toISOString(), errors });
    logger.error("scan_failed", `Scan crashed: ${err instanceof Error ? err.message : String(err)}`, { scanId });
  }
}

function fail(scanId: string, stage: ScanStage, message: string, errors: ScanError[]): void {
  errors.push({ stage, message, timestamp: new Date().toISOString() });
  updateScan(scanId, { status: "failed", stage: "done", completedAt: new Date().toISOString(), errors });
  logger.error("scan_failed", message, { scanId });
}

function recordStageError(
  scanId: string,
  stage: ScanStage,
  errors: ScanError[],
  err: unknown,
  questionId?: string,
  provider?: ResponseAnalysis["provider"],
): void {
  const message = err instanceof Error ? err.message : String(err);
  errors.push({ stage, questionId, provider, message, timestamp: new Date().toISOString() });
  logger.error("stage_error", `Error in stage "${stage}": ${message}`, { scanId, questionId, provider });
}

function buildGeoScoreInput(
  responses: AIResponse[],
  analyses: ResponseAnalysis[],
  competitors: ReturnType<typeof aggregateCompetitors>,
  crossModel: ReturnType<typeof analyzeCrossModel>,
  totalValidQuestions: number,
  totalProviders: number,
) {
  const successfulResponses = responses.filter((r) => r.status === "success").length;
  const businessMentionCount = analyses.filter((a) => a.mention.mentioned).length;
  const recommendedCount = analyses.filter((a) => a.mention.recommended).length;

  const relativePositions = analyses
    .filter((a) => a.mention.mentioned && a.position.hasRanking && a.position.relativePosition !== null)
    .map((a) => a.position.relativePosition as number);

  return {
    overallMentionRate: successfulResponses > 0 ? businessMentionCount / successfulResponses : 0,
    overallRecommendationRate: successfulResponses > 0 ? recommendedCount / successfulResponses : 0,
    averageRelativePosition: relativePositions.length > 0 ? relativePositions.reduce((a, b) => a + b, 0) / relativePositions.length : null,
    businessMentionCount,
    competitors,
    crossModel,
    totalValidQuestions,
    totalProviders,
    successfulResponses,
  };
}

export function scanNeedsProcessing(scan: Scan): boolean {
  return scan.status === "pending";
}
