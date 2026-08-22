import type { Business, BusinessResearch, GeneratedQuestion } from "../../models/types.js";
import { logger } from "../../logging/logger.js";

function relevanceTerms(business: Business, research: BusinessResearch): string[] {
  return Array.from(
    new Set(
      [
        business.industry,
        business.location,
        ...research.productsServices,
        ...research.categories,
        ...research.keyPropositions,
        ...research.likelyCompetitors,
      ]
        .filter((t): t is string => !!t && t.trim().length > 0)
        .map((t) => t.toLowerCase()),
    ),
  );
}

/**
 * Validates generated questions: drops exact duplicates and flags questions that
 * reference none of the business's known context (industry/location/services/
 * propositions) as likely irrelevant, per the requirement that the generator must
 * not ask things unrelated to the business.
 */
export function validateQuestions(
  questions: GeneratedQuestion[],
  business: Business,
  research: BusinessResearch,
): GeneratedQuestion[] {
  const terms = relevanceTerms(business, research);
  const seen = new Set<string>();

  const validated = questions.map((q): GeneratedQuestion => {
    const normalized = q.question.toLowerCase().trim();

    if (seen.has(normalized)) {
      return { ...q, valid: false, invalidReason: "duplicate_question" };
    }
    seen.add(normalized);

    const relevant = terms.length === 0 || terms.some((term) => normalized.includes(term));
    if (!relevant) {
      return { ...q, valid: false, invalidReason: "no_relevance_to_business_context" };
    }

    if (q.question.trim().length < 8) {
      return { ...q, valid: false, invalidReason: "question_too_short" };
    }

    return q;
  });

  const invalidCount = validated.filter((q) => !q.valid).length;
  if (invalidCount > 0) {
    logger.warning(
      "question_validation_dropped",
      `${invalidCount}/${validated.length} generated questions were flagged invalid`,
      { scanId: questions[0]?.scanId },
      { invalidCount, total: validated.length },
    );
  }

  return validated;
}
