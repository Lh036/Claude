import type { MentionResult } from "../../models/types.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RECOMMENDATION_KEYWORDS = [
  "aanbevelen",
  "aanbeveling",
  "aanrader",
  "aan te raden",
  "sterk aanbevolen",
  "beste keuze",
  "topkeuze",
  "top keuze",
  "eerste keuze",
  "recommend",
  "top pick",
  "top choice",
  "would recommend",
  "great choice",
];

// Dutch separable verbs ("raden ... aan", "bevelen ... aan") split their particle
// from the verb stem, so a plain substring check misses them — matched separately.
const RECOMMENDATION_PATTERNS = [/\b(raad|raden|beveel|bevelen)\b[\s\S]{0,40}\baan\b/i];

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Robust mention detection: matches every known surface form of the business name
 * (full name, stripped-suffix name, acronym, domain, "&"/"and" variants — see
 * utils/nameVariants.ts) with word-boundary matching so "H&M" doesn't match inside
 * an unrelated word. This is deliberately more than a single exact string compare
 * (section 12).
 */
export function detectMention(answer: string, nameVariants: string[]): MentionResult {
  const usableVariants = Array.from(new Set(nameVariants.filter((v) => v.trim().length >= 2)))
    // Longer variants first so "Acme Marketing" is preferred over a shorter "Acme" match at the same spot.
    .sort((a, b) => b.length - a.length);

  if (usableVariants.length === 0) {
    return { mentioned: false, occurrences: 0, matchedVariants: [], recommended: false };
  }

  const pattern = usableVariants.map(escapeRegex).join("|");
  const regex = new RegExp(`(?<![\\w])(?:${pattern})(?![\\w])`, "gi");

  const matches = Array.from(answer.matchAll(regex));
  if (matches.length === 0) {
    return { mentioned: false, occurrences: 0, matchedVariants: [], recommended: false };
  }

  const matchedVariants = new Set<string>();
  for (const m of matches) {
    const matchedText = m[0].toLowerCase();
    const variant = usableVariants.find((v) => v.toLowerCase() === matchedText);
    matchedVariants.add(variant ?? matchedText);
  }

  const sentences = splitSentences(answer);
  const mentionSentences = sentences.filter((s) => regex.test(s));
  regex.lastIndex = 0;
  const recommended = mentionSentences.some(
    (s) =>
      RECOMMENDATION_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)) ||
      RECOMMENDATION_PATTERNS.some((re) => re.test(s)),
  );

  return {
    mentioned: true,
    occurrences: matches.length,
    matchedVariants: Array.from(matchedVariants),
    recommended,
  };
}
