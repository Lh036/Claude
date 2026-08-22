/**
 * Shared domain types for the GEO system. Every service module and the API layer
 * import from here so the pipeline stages agree on shape without depending on
 * each other's internals.
 */

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export interface Business {
  id: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  /** Free-form bag for future fields (social handles, founding year, etc.) without a schema migration. */
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

/** Output of the business-research phase: context used to keep question generation on-topic. */
export interface BusinessResearch {
  businessId: string;
  productsServices: string[];
  targetAudience: string[];
  keyPropositions: string[];
  categories: string[];
  likelyCompetitors: string[];
  nameVariants: string[];
  researchedAt: string;
  /** "heuristic" = derived from the structured business fields only; "ai" = an AI provider assisted. */
  source: "heuristic" | "ai";
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

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
  /** Set to false by the validator when a question is dropped for being off-topic/duplicate. */
  valid: boolean;
  invalidReason?: string;
}

// ---------------------------------------------------------------------------
// AI providers
// ---------------------------------------------------------------------------

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
  /** Whether retrying is expected to help. Auth errors are not retryable; timeouts/rate limits are. */
  retryable: boolean;
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
}

export interface ProviderQueryResult {
  provider: ProviderName;
  model: string;
  question: string;
  /** Raw text response. Null when the call failed. */
  answer: string | null;
  timestamp: string;
  durationMs: number;
  status: "success" | "failed";
  error: ProviderError | null;
  usage: TokenUsage;
}

// ---------------------------------------------------------------------------
// Responses (persisted form of a ProviderQueryResult, tied to a scan/question)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface MentionResult {
  mentioned: boolean;
  occurrences: number;
  /** Which surface forms of the business name matched (full name, abbreviation, domain, ...). */
  matchedVariants: string[];
  recommended: boolean;
}

export interface PositionResult {
  /** False when the answer has no discernible list/ranking structure — never invented. */
  hasRanking: boolean;
  position: number | null;
  totalCompaniesMentioned: number | null;
  relativePosition: number | null; // position / totalCompaniesMentioned, 0..1, lower is better
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

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

export interface CompetitorAggregate {
  name: string;
  mentions: number;
  averagePosition: number | null;
  providers: Partial<Record<ProviderName, number>>;
  questionIds: string[];
  categories: QuestionCategory[];
}

// ---------------------------------------------------------------------------
// Cross-model analysis
// ---------------------------------------------------------------------------

export interface ProviderPerformance {
  provider: ProviderName;
  totalQuestions: number;
  successfulResponses: number;
  failedResponses: number;
  mentionRate: number; // 0..1
  averagePosition: number | null;
  recommendationRate: number; // 0..1
  uniqueCompetitorsSeen: number;
}

export interface CrossModelAnalysis {
  perProvider: ProviderPerformance[];
  mentionRateSpread: number; // max - min mention rate across providers
  agreement: {
    /** Share of questions where mention outcome (mentioned/not) agrees across all providers with a response. */
    mentionAgreementRate: number;
  };
}

// ---------------------------------------------------------------------------
// GEO Score
// ---------------------------------------------------------------------------

export interface GeoScoreBreakdown {
  mentionRateScore: number;
  positionScore: number;
  recommendationScore: number;
  competitorVisibilityScore: number;
  crossModelVisibilityScore: number;
  queryCoverageScore: number;
}

export interface GeoScore {
  total: number; // 0..100
  breakdown: GeoScoreBreakdown;
  weights: GeoScoreBreakdown;
  explanation: string;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export interface Recommendation {
  id: string;
  priority: QuestionPriority;
  problem: string;
  observation: string;
  recommendation: string;
  /** IDs of responses/analyses that this recommendation was derived from. */
  evidenceResponseIds: string[];
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

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
