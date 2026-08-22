import type { AIResponse, BusinessResearch, ResponseAnalysis } from "../../models/types.js";
import { generateId } from "../../utils/id.js";
import { detectMention } from "./mentionDetection.service.js";
import { analyzePosition, extractRankedListItems } from "./positionAnalysis.service.js";
import { analyzeContext } from "./contextAnalysis.service.js";
import { detectCompetitorsInResponse } from "./competitorDetection.service.js";
import { saveAnalysis } from "../../db/analysis.repository.js";
import { logger } from "../../logging/logger.js";

/**
 * Runs the full response-analysis stage (sections 11-15) for one AI response:
 * mention detection, position analysis, context extraction, and per-response
 * competitor detection. Skips analysis for a failed/empty response instead of
 * crashing — the result simply records "not mentioned, no ranking".
 */
export function analyzeResponse(response: AIResponse, location: string | null, research: BusinessResearch): ResponseAnalysis {
  const answer = response.status === "success" ? response.answer ?? "" : "";
  const listItems = answer ? extractRankedListItems(answer) : [];

  const mention = answer
    ? detectMention(answer, research.nameVariants)
    : { mentioned: false, occurrences: 0, matchedVariants: [], recommended: false };

  const position = analyzePosition(research.nameVariants, listItems);
  const context = answer
    ? analyzeContext(answer, research.nameVariants, research, location)
    : { servicesM: [], strengths: [], weaknesses: [], audienceMentioned: [], locationMentioned: [], attributes: [], surroundingText: null };
  const competitorsDetected = detectCompetitorsInResponse(listItems, research.nameVariants);

  const analysis: ResponseAnalysis = {
    id: generateId("an"),
    scanId: response.scanId,
    responseId: response.id,
    questionId: response.questionId,
    provider: response.provider,
    mention,
    position,
    context,
    competitorsDetected,
    analyzedAt: new Date().toISOString(),
  };

  saveAnalysis(analysis);
  logger.debug("response_analyzed", `Analyzed ${response.provider} response (mentioned=${mention.mentioned})`, {
    scanId: response.scanId,
    questionId: response.questionId,
    provider: response.provider,
  });

  return analysis;
}
