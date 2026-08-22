/**
 * Mirrors the backend's shared domain types (../../../src/models/types.ts) plus
 * the log entry shape (../../../src/logging/logger.ts). Kept as plain data types
 * (no backend imports — the frontend is a separate deployable) so this file is
 * the single place to update if the backend's API shape changes.
 */

export interface Business {
  id: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  extra: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessInput {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  description?: string | null;
  extra?: Record<string, unknown>;
}

export interface BusinessResearch {
  businessId: string;
  productsServices: string[];
  targetAudience: string[];
  keyPropositions: string[];
  categories: string[];
  likelyCompetitors: string[];
  nameVariants: string[];
  researchedAt: string;
  source: "heuristic" | "ai";
}

export type QuestionCategory =
  | "recommendation"
  | "comparison"
  | "best_of"
  | "problem_based"
  | "local"
  | "industry"
  | "buyer_intent";

export type SearchIntent = "commercial" | "informational" | "navigational";
export type QuestionPriority = "high" | "medium" | "low";

export interface GeneratedQuestion {
  id: string;
  scanId: string;
  question: string;
  category: QuestionCategory;
  intent: SearchIntent;
  location: string | null;
  industry: string | null;
  priority: QuestionPriority;
  reason: string;
  valid: boolean;
  invalidReason?: string;
}

export type ProviderName = "openai" | "gemini" | "anthropic" | "mock";

export type ProviderErrorKind =
  | "timeout"
  | "rate_limit"
  | "authentication"
  | "invalid_response"
  | "empty_response"
  | "provider_unavailable"
  | "parsing_error"
  | "network_error"
  | "unknown";

export interface ProviderError {
  kind: ProviderErrorKind;
  message: string;
  retryable: boolean;
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
}

export interface AIResponse {
  id: string;
  scanId: string;
  questionId: string;
  provider: ProviderName;
  model: string;
  question: string;
  answer: string | null;
  timestamp: string;
  durationMs: number;
  status: "success" | "failed";
  error: ProviderError | null;
  usage: TokenUsage;
  attempt: number;
}

export interface MentionResult {
  mentioned: boolean;
  occurrences: number;
  matchedVariants: string[];
  recommended: boolean;
}

export interface PositionResult {
  hasRanking: boolean;
  position: number | null;
  totalCompaniesMentioned: number | null;
  relativePosition: number | null;
}

export interface ContextAnalysisResult {
  servicesM: string[];
  strengths: string[];
  weaknesses: string[];
  audienceMentioned: string[];
  locationMentioned: string[];
  attributes: string[];
  surroundingText: string | null;
}

export interface DetectedCompetitorMention {
  name: string;
  position: number | null;
}

export interface ResponseAnalysis {
  id: string;
  scanId: string;
  responseId: string;
  questionId: string;
  provider: ProviderName;
  mention: MentionResult;
  position: PositionResult;
  context: ContextAnalysisResult;
  competitorsDetected: DetectedCompetitorMention[];
  analyzedAt: string;
}

export interface CompetitorAggregate {
  name: string;
  mentions: number;
  averagePosition: number | null;
  providers: Partial<Record<ProviderName, number>>;
  questionIds: string[];
  categories: QuestionCategory[];
}

export interface ProviderPerformance {
  provider: ProviderName;
  totalQuestions: number;
  successfulResponses: number;
  failedResponses: number;
  mentionRate: number;
  averagePosition: number | null;
  recommendationRate: number;
  uniqueCompetitorsSeen: number;
}

export interface CrossModelAnalysis {
  perProvider: ProviderPerformance[];
  mentionRateSpread: number;
  agreement: { mentionAgreementRate: number };
}

export interface GeoScoreBreakdown {
  mentionRateScore: number;
  positionScore: number;
  recommendationScore: number;
  competitorVisibilityScore: number;
  crossModelVisibilityScore: number;
  queryCoverageScore: number;
}

export interface GeoScore {
  total: number;
  breakdown: GeoScoreBreakdown;
  weights: GeoScoreBreakdown;
  explanation: string;
}

export interface Recommendation {
  id: string;
  priority: QuestionPriority;
  problem: string;
  observation: string;
  recommendation: string;
  evidenceResponseIds: string[];
}

export type ScanStatus = "pending" | "running" | "completed" | "failed" | "partial";

export type ScanStage =
  | "created"
  | "research"
  | "question_generation"
  | "question_validation"
  | "ai_querying"
  | "response_analysis"
  | "competitor_detection"
  | "cross_model_analysis"
  | "scoring"
  | "recommendations"
  | "done";

export interface ScanError {
  stage: ScanStage;
  questionId?: string;
  provider?: ProviderName;
  message: string;
  timestamp: string;
}

export interface ScanStatistics {
  totalQuestions: number;
  totalResponses: number;
  successfulResponses: number;
  failedResponses: number;
  mentioned: number;
  notMentioned: number;
  averagePosition: number | null;
  topCompetitors: CompetitorAggregate[];
  providerPerformance: ProviderPerformance[];
  geoScore: number | null;
  estimatedCostUsd: number;
  durationMs: number | null;
}

export interface ScanOptions {
  questionCount: number;
  providers: ProviderName[];
}

export interface Scan {
  id: string;
  businessId: string;
  status: ScanStatus;
  stage: ScanStage;
  options: ScanOptions;
  startedAt: string | null;
  completedAt: string | null;
  errors: ScanError[];
  createdAt: string;
  updatedAt: string;
}

export interface ScanSummary extends Scan {
  geoScore: GeoScore | null;
  statistics: ScanStatistics | null;
}

export interface ScanResult {
  scan: Scan;
  business: Business;
  research: BusinessResearch | null;
  questions: GeneratedQuestion[];
  responses: AIResponse[];
  analyses: ResponseAnalysis[];
  competitors: CompetitorAggregate[];
  crossModel: CrossModelAnalysis | null;
  geoScore: GeoScore | null;
  recommendations: Recommendation[];
  statistics: ScanStatistics | null;
  errors: ScanError[];
}

export type LogLevel = "DEBUG" | "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface LogEntry {
  id?: number;
  timestamp: string;
  level: LogLevel;
  event: string;
  scanId?: string;
  questionId?: string;
  provider?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LogQueryResult {
  entries: LogEntry[];
  total: number;
}

export const ALL_PROVIDERS: ProviderName[] = ["openai", "gemini", "anthropic"];
export const QUESTION_COUNT_OPTIONS = [10, 15, 25, 50, 100] as const;
