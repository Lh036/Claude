export interface ExtractedListItem {
  position: number; // 1-based
  rawText: string;
  candidateName: string;
}

// Matches list markers at the start of a line: "1.", "1)", "-", "*", "•".
const LIST_MARKER_RE = /^\s*(?:(\d{1,3})[.)]|[-*•])\s+(.*)$/;

/**
 * Detects a ranked or bulleted list of items in a free-text AI answer. Only lines
 * that visibly start with a numbering/bullet marker count — this is deliberately
 * conservative so the position analyzer never invents a ranking that isn't really
 * there in the text (section 13: "if there's no clear ranking, say so").
 */
export function extractRankedListItems(answer: string): ExtractedListItem[] {
  const lines = answer.split(/\r?\n/);
  const items: ExtractedListItem[] = [];
  let autoIndex = 0;

  for (const line of lines) {
    const match = LIST_MARKER_RE.exec(line);
    if (!match) continue;
    autoIndex++;
    const explicitNumber = match[1] ? Number.parseInt(match[1], 10) : null;
    const rawText = (match[2] ?? "").trim();
    if (rawText.length === 0) continue;
    items.push({
      position: explicitNumber ?? autoIndex,
      rawText,
      candidateName: extractCandidateName(rawText),
    });
  }

  // Numbered lists ("1.", "2.", ...) are a much stronger ranking signal than a
  // handful of bare "-" bullets scattered through prose. Require at least 2 items.
  return items.length >= 2 ? items : [];
}

function extractCandidateName(rawText: string): string {
  let text = rawText.replace(/\*\*/g, "").trim();
  // Cut at the first separator that typically introduces a description, e.g.
  // "Acme Corp - great service" or "Acme Corp: great service".
  const separatorMatch = text.match(/^(.*?)(?:\s[-–—]\s|\s?:\s|\s\()/);
  if (separatorMatch && separatorMatch[1] && separatorMatch[1].trim().length > 0) {
    text = separatorMatch[1].trim();
  }
  return text.slice(0, 80).trim();
}
