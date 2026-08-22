import {
  createScan as createScanRow,
  getScan as getScanRow,
  listScansForBusiness as listScansRow,
  listAllScans as listAllScansRow,
  getScanResults,
  type ScanListFilter,
} from "../../db/scan.repository.js";
import { getQuestionsForScan } from "../../db/question.repository.js";
import { getResponsesForScan } from "../../db/response.repository.js";
import { getAnalysesForScan, getCompetitorsForScan } from "../../db/analysis.repository.js";
import { getRecommendationsForScan } from "../../db/recommendation.repository.js";
import { getBusiness } from "../../db/business.repository.js";
import { getBusinessResearch } from "../business/research.service.js";
import { runScan } from "./scanOrchestrator.service.js";
import { allSupportedProviderNames } from "../../providers/registry.js";
import { config } from "../../config/index.js";
import { logger } from "../../logging/logger.js";
import type { GeoScore, ProviderName, Scan, ScanResult, ScanStatistics } from "../../models/types.js";

export interface CreateScanInput {
  businessId: string;
  questionCount?: number;
  providers?: ProviderName[];
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Creates a scan row (status "pending") and schedules the pipeline to run in the
 * background. This is the async/job-style boundary from section 19: the HTTP
 * caller gets an immediate response with the scan id, and polls getScan /
 * getScanResult for progress instead of blocking on a potentially long-running
 * multi-provider AI query batch. The in-process scheduler here is intentionally
 * simple (no external broker) — see docs/ARCHITECTURE.md for how to swap in a
 * real job queue (e.g. BullMQ) without touching the pipeline stages themselves.
 */
export function createScan(input: CreateScanInput): Scan {
  const business = getBusiness(input.businessId);
  if (!business) {
    throw new NotFoundError(`Business ${input.businessId} not found`);
  }

  const questionCount = input.questionCount && input.questionCount > 0 ? input.questionCount : config().defaultQuestionCount;
  const providers = input.providers && input.providers.length > 0 ? input.providers : allSupportedProviderNames();

  const scan = createScanRow(input.businessId, { questionCount, providers });
  logger.info("scan_created", `Scan created for business ${business.companyName}`, { scanId: scan.id }, {
    questionCount,
    providers,
  });

  scheduleScan(scan.id);
  return scan;
}

function scheduleScan(scanId: string): void {
  queueMicrotask(() => {
    runScan(scanId).catch((err) => {
      logger.error("scan_unhandled_error", `Unhandled error running scan: ${err instanceof Error ? err.message : String(err)}`, {
        scanId,
      });
    });
  });
}

export function getScan(id: string): Scan | null {
  return getScanRow(id);
}

export function listScansForBusiness(businessId: string): Scan[] {
  return listScansRow(businessId);
}

/** A scan row enriched with its (possibly not-yet-computed) score/statistics, for list views. */
export interface ScanSummary extends Scan {
  geoScore: GeoScore | null;
  statistics: ScanStatistics | null;
}

/**
 * Lists scans across all businesses for the frontend's global Scans/Runs views,
 * each enriched with its GEO score and statistics (both null until the scan
 * reaches the scoring stage). Read-only composition over existing repositories —
 * no new business logic.
 */
export function listScans(filter: ScanListFilter = {}): ScanSummary[] {
  return listAllScansRow(filter).map((scan) => {
    const { geoScore, statistics } = getScanResults(scan.id);
    return { ...scan, geoScore, statistics };
  });
}

export function getScanQuestions(id: string) {
  return getQuestionsForScan(id);
}

export function getScanResponses(id: string) {
  return getResponsesForScan(id);
}

export function getScanAnalyses(id: string) {
  return getAnalysesForScan(id);
}

export function getScanCompetitors(id: string) {
  return getCompetitorsForScan(id);
}

export function getScanRecommendations(id: string) {
  return getRecommendationsForScan(id);
}

export function getScanStatistics(id: string) {
  return getScanResults(id).statistics;
}

export function getScanResult(id: string): ScanResult | null {
  const scan = getScanRow(id);
  if (!scan) return null;
  const business = getBusiness(scan.businessId);
  if (!business) return null;

  const { crossModel, geoScore, statistics } = getScanResults(id);

  return {
    scan,
    business,
    research: getBusinessResearch(business.id),
    questions: getQuestionsForScan(id),
    responses: getResponsesForScan(id),
    analyses: getAnalysesForScan(id),
    competitors: getCompetitorsForScan(id),
    crossModel,
    geoScore,
    recommendations: getRecommendationsForScan(id),
    statistics,
    errors: scan.errors,
  };
}
