import type { PositionResult } from "../../models/types.js";
import { extractRankedListItems, type ExtractedListItem } from "./listExtraction.js";

function nameMatchesVariant(candidateName: string, nameVariants: string[]): boolean {
  const normalized = candidateName.toLowerCase();
  return nameVariants.some((v) => {
    const nv = v.toLowerCase();
    return normalized === nv || normalized.includes(nv) || nv.includes(normalized);
  });
}

/**
 * Determines the business's position within a ranked list, if the answer actually
 * contains one. When no numbered/bulleted ranking is present, every field is set
 * to null/false instead of guessing a position (section 13).
 */
export function analyzePosition(nameVariants: string[], listItems: ExtractedListItem[] = []): PositionResult {
  if (listItems.length === 0) {
    return { hasRanking: false, position: null, totalCompaniesMentioned: null, relativePosition: null };
  }

  const match = listItems.find((item) => nameMatchesVariant(item.candidateName, nameVariants));

  return {
    hasRanking: true,
    position: match ? match.position : null,
    totalCompaniesMentioned: listItems.length,
    relativePosition: match ? match.position / listItems.length : null,
  };
}

export { extractRankedListItems };
