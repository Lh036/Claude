import type { ExtractedListItem } from "./listExtraction.js";
import type {
  CompetitorAggregate,
  DetectedCompetitorMention,
  GeneratedQuestion,
  ProviderName,
  ResponseAnalysis,
} from "../../models/types.js";

function isTargetBusiness(candidateName: string, nameVariants: string[]): boolean {
  const normalized = candidateName.toLowerCase();
  return nameVariants.some((v) => {
    const nv = v.toLowerCase();
    return normalized === nv || normalized.includes(nv) || nv.includes(normalized);
  });
}

function isPlausibleCompanyName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  // Reject list items that are clearly generic advice rather than a company name
  // (e.g. "Kijk naar reviews voordat je kiest").
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount <= 6;
}

/**
 * Finds companies other than the target business inside a single response's
 * ranked list. This is the per-response signal that scan-level aggregation
 * (aggregateCompetitors) rolls up across all questions/providers.
 */
export function detectCompetitorsInResponse(
  listItems: ExtractedListItem[],
  targetNameVariants: string[],
): DetectedCompetitorMention[] {
  return listItems
    .filter((item) => isPlausibleCompanyName(item.candidateName) && !isTargetBusiness(item.candidateName, targetNameVariants))
    .map((item) => ({ name: item.candidateName, position: item.position }));
}

function canonicalName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Rolls up competitor mentions across every analyzed response in a scan into a
 * per-competitor dataset: how often each rival appears, at what average position,
 * split by provider, and which questions/categories surfaced them (section 14).
 */
export function aggregateCompetitors(
  analyses: ResponseAnalysis[],
  questionsById: Map<string, GeneratedQuestion>,
): CompetitorAggregate[] {
  const byName = new Map<string, CompetitorAggregate & { positions: number[] }>();

  for (const analysis of analyses) {
    const question = questionsById.get(analysis.questionId);
    for (const mention of analysis.competitorsDetected) {
      const key = canonicalName(mention.name);
      if (!key) continue;
      let entry = byName.get(key);
      if (!entry) {
        entry = {
          name: mention.name,
          mentions: 0,
          averagePosition: null,
          providers: {},
          questionIds: [],
          categories: [],
          positions: [],
        };
        byName.set(key, entry);
      }
      entry.mentions++;
      if (mention.position !== null) entry.positions.push(mention.position);
      entry.providers[analysis.provider as ProviderName] = (entry.providers[analysis.provider as ProviderName] ?? 0) + 1;
      if (!entry.questionIds.includes(analysis.questionId)) entry.questionIds.push(analysis.questionId);
      if (question && !entry.categories.includes(question.category)) entry.categories.push(question.category);
    }
  }

  return Array.from(byName.values())
    .map(({ positions, ...rest }) => ({
      ...rest,
      averagePosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
    }))
    .sort((a, b) => b.mentions - a.mentions);
}
