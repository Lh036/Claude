import type { BusinessResearch, ContextAnalysisResult } from "../../models/types.js";

const STRENGTH_KEYWORDS = [
  "sterk",
  "sterke",
  "uitstekend",
  "uitstekende",
  "goed",
  "goede",
  "betrouwbaar",
  "betrouwbare",
  "professioneel",
  "professionele",
  "ervaren",
  "topkwaliteit",
  "hoge kwaliteit",
  "scherpe prijzen",
  "snelle",
  "vriendelijk",
  "excellent",
  "reliable",
  "trusted",
  "high quality",
  "great",
  "affordable",
];

const WEAKNESS_KEYWORDS = [
  "duur",
  "dure",
  "traag",
  "langzame",
  "beperkt",
  "beperkte",
  "minder geschikt",
  "niet ideaal",
  "klachten",
  "matige",
  "matig",
  "expensive",
  "slow",
  "limited",
  "mixed reviews",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function findMentionSentences(answer: string, nameVariants: string[]): string[] {
  if (nameVariants.length === 0) return [];
  const pattern = nameVariants
    .filter((v) => v.trim().length >= 2)
    .map(escapeRegex)
    .join("|");
  if (!pattern) return [];
  const regex = new RegExp(`(?<![\\w])(?:${pattern})(?![\\w])`, "i");
  return splitSentences(answer).filter((s) => regex.test(s));
}

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw));
}

/**
 * Rule-based context extraction around the sentence(s) where the business is
 * mentioned: which known services/audience/location terms co-occur, and which
 * positive/negative descriptive keywords appear nearby. Deliberately heuristic
 * (no external NLP dependency) — good enough to surface real signal for
 * recommendations without inventing context the answer never stated.
 */
export function analyzeContext(
  answer: string,
  nameVariants: string[],
  research: BusinessResearch,
  location: string | null,
): ContextAnalysisResult {
  const mentionSentences = findMentionSentences(answer, nameVariants);
  const window = mentionSentences.length > 0 ? mentionSentences.join(" ") : "";
  const windowLower = window.toLowerCase();

  const servicesM = research.productsServices.filter((s) => windowLower.includes(s.toLowerCase()));
  const audienceMentioned = research.targetAudience.filter((a) => windowLower.includes(a.toLowerCase()));
  const locationMentioned = location && windowLower.includes(location.toLowerCase()) ? [location] : [];

  const strengths = matchKeywords(window, STRENGTH_KEYWORDS);
  const weaknesses = matchKeywords(window, WEAKNESS_KEYWORDS);
  const attributes = Array.from(new Set([...strengths, ...weaknesses]));

  return {
    servicesM,
    strengths,
    weaknesses,
    audienceMentioned,
    locationMentioned,
    attributes,
    surroundingText: mentionSentences.length > 0 ? window.slice(0, 500) : null,
  };
}
