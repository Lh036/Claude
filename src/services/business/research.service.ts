import { generateNameVariants } from "../../utils/nameVariants.js";
import { saveBusinessResearch, getBusinessResearch as getBusinessResearchRow } from "../../db/business.repository.js";
import type { Business, BusinessResearch } from "../../models/types.js";
import { logger } from "../../logging/logger.js";

/**
 * Splits a free-text description into short candidate phrases (sentences/clauses).
 * This is intentionally simple rule-based extraction, not NLP — it keeps question
 * generation grounded in what the business actually said about itself rather than
 * inventing propositions that were never stated.
 */
function extractPhrases(text: string | null, maxLen = 8): string[] {
  if (!text) return [];
  return text
    .split(/[.;\n]|,(?=\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.split(/\s+/).length <= 40)
    .slice(0, maxLen);
}

/** Reads structured hints from the business's extensible `extra` bag without guessing. */
function readExtraList(extra: Record<string, unknown>, key: string): string[] {
  const value = extra[key];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  return [];
}

/**
 * Heuristic business research: derives context strictly from what the caller provided
 * (structured fields + free-text description + explicit `extra` hints). Runs with zero
 * network calls, so it always succeeds and is safe to use in test mode.
 */
export function researchBusinessHeuristically(business: Business): BusinessResearch {
  const productsServices = [
    ...readExtraList(business.extra, "services"),
    ...readExtraList(business.extra, "products"),
  ];
  const keyPropositions = extractPhrases(business.description);
  const categories = Array.from(
    new Set([business.industry, ...readExtraList(business.extra, "categories")].filter((c): c is string => !!c)),
  );

  const research: BusinessResearch = {
    businessId: business.id,
    productsServices: Array.from(new Set(productsServices.length > 0 ? productsServices : categories)),
    targetAudience: readExtraList(business.extra, "targetAudience"),
    keyPropositions,
    categories,
    likelyCompetitors: readExtraList(business.extra, "competitors"),
    nameVariants: generateNameVariants(business.companyName, business.website),
    researchedAt: new Date().toISOString(),
    source: "heuristic",
  };

  return research;
}

/**
 * Optional AI-assisted augmentation: takes heuristic research and a caller-supplied
 * query function (typically backed by an AIProvider) to fill in gaps — likely
 * competitors, target audience, propositions — when the caller didn't supply them.
 * Kept decoupled from the provider layer so business research has no hard dependency
 * on any specific AI provider or on network access being available.
 */
export async function augmentResearchWithAi(
  business: Business,
  base: BusinessResearch,
  queryFn: (prompt: string) => Promise<string>,
): Promise<BusinessResearch> {
  const needsHelp =
    base.likelyCompetitors.length === 0 || base.productsServices.length === 0 || base.targetAudience.length === 0;
  if (!needsHelp) return base;

  const prompt = [
    `You are researching a company for a marketing analysis. Respond ONLY with strict JSON, no prose.`,
    `Company: ${business.companyName}`,
    business.website ? `Website: ${business.website}` : null,
    business.industry ? `Industry: ${business.industry}` : null,
    business.location ? `Location: ${business.location}` : null,
    business.description ? `Description: ${business.description}` : null,
    `Return JSON with keys: productsServices (string[]), targetAudience (string[]), keyPropositions (string[]), categories (string[]), likelyCompetitors (string[]).`,
    `Only include real, plausible companies as competitors. If unsure, return an empty array rather than guessing.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await queryFn(prompt);
    const parsed = JSON.parse(extractJsonBlock(raw)) as Partial<{
      productsServices: string[];
      targetAudience: string[];
      keyPropositions: string[];
      categories: string[];
      likelyCompetitors: string[];
    }>;

    return {
      ...base,
      productsServices: base.productsServices.length > 0 ? base.productsServices : parsed.productsServices ?? [],
      targetAudience: base.targetAudience.length > 0 ? base.targetAudience : parsed.targetAudience ?? [],
      keyPropositions: base.keyPropositions.length > 0 ? base.keyPropositions : parsed.keyPropositions ?? [],
      categories: base.categories.length > 0 ? base.categories : parsed.categories ?? [],
      likelyCompetitors: base.likelyCompetitors.length > 0 ? base.likelyCompetitors : parsed.likelyCompetitors ?? [],
      source: "ai",
    };
  } catch (err) {
    logger.warning("business_research_ai_augment_failed", `AI research augmentation failed, keeping heuristic result`, {
      scanId: undefined,
    }, { businessId: business.id, error: err instanceof Error ? err.message : String(err) });
    return base;
  }
}

function extractJsonBlock(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export function researchBusiness(business: Business): BusinessResearch {
  const research = researchBusinessHeuristically(business);
  saveBusinessResearch(research);
  logger.info("business_research_completed", `Researched ${business.companyName}`, undefined, {
    businessId: business.id,
    source: research.source,
  });
  return research;
}

export function persistResearch(research: BusinessResearch): void {
  saveBusinessResearch(research);
}

export function getBusinessResearch(businessId: string): BusinessResearch | null {
  return getBusinessResearchRow(businessId);
}
