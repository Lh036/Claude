import { QUESTION_TEMPLATES, type QuestionTemplate } from "./templates.js";
import { generateId } from "../../utils/id.js";
import type { Business, BusinessResearch, GeneratedQuestion, QuestionCategory } from "../../models/types.js";
import { logger } from "../../logging/logger.js";

export interface QuestionGeneratorOptions {
  /** Total number of questions to generate for the scan. Never hardcoded — caller decides (10, 15, 25, 50, 100, ...). */
  count: number;
}

interface DataPools {
  services: string[];
  locations: string[];
  competitors: string[];
  problems: string[];
  niches: string[];
}

function buildDataPools(business: Business, research: BusinessResearch): DataPools {
  const services = research.productsServices.length > 0 ? research.productsServices : [business.industry].filter((s): s is string => !!s);
  const niches = research.categories.length > 0 ? research.categories : services;
  const locations = [business.location].filter((l): l is string => !!l);
  const competitors = research.likelyCompetitors;
  const problems = research.keyPropositions.length > 0 ? research.keyPropositions : services.map((s) => `het vinden van een goede ${s}`);

  return { services, locations, competitors, problems, niches };
}

function fillableVars(
  template: QuestionTemplate,
  pools: DataPools,
  cursor: Record<string, number>,
): Record<string, string> | null {
  const vars: Record<string, string> = {};
  for (const placeholder of template.placeholders) {
    const key = placeholder === "service" ? "services" : placeholder === "niche" ? "niches" : placeholder === "location" ? "locations" : placeholder === "competitor" ? "competitors" : "problems";
    const list = pools[key as keyof DataPools];
    if (list.length === 0) return null; // Can't fill this template with real data — skip it, don't invent filler.
    const idx = (cursor[key] ?? 0) % list.length;
    cursor[key] = idx + 1;
    vars[placeholder] = list[idx] as string;
  }
  return vars;
}

/**
 * Generates `options.count` GEO questions distributed across the 7 categories,
 * grounded only in real business data (services/niches/location/competitors/
 * propositions gathered during the research phase). Templates whose placeholders
 * cannot be filled from real data are skipped rather than padded with filler text.
 */
export function generateQuestions(
  business: Business,
  research: BusinessResearch,
  scanId: string,
  options: QuestionGeneratorOptions,
): GeneratedQuestion[] {
  if (options.count <= 0) {
    throw new Error("QuestionGeneratorOptions.count must be a positive integer");
  }

  const pools = buildDataPools(business, research);
  const templatesByCategory = new Map<QuestionCategory, QuestionTemplate[]>();
  for (const t of QUESTION_TEMPLATES) {
    const list = templatesByCategory.get(t.category) ?? [];
    list.push(t);
    templatesByCategory.set(t.category, list);
  }
  const categories = Array.from(templatesByCategory.keys());

  // Even distribution of the requested count across categories, remainder to the first categories.
  const base = Math.floor(options.count / categories.length);
  const remainder = options.count % categories.length;
  const perCategoryTarget = new Map<QuestionCategory, number>();
  categories.forEach((c, i) => perCategoryTarget.set(c, base + (i < remainder ? 1 : 0)));

  const questions: GeneratedQuestion[] = [];
  const seenText = new Set<string>();
  const cursor: Record<string, number> = {};

  for (const category of categories) {
    const target = perCategoryTarget.get(category) ?? 0;
    const templates = templatesByCategory.get(category) ?? [];
    let produced = 0;
    let attempts = 0;
    const maxAttempts = target * templates.length * 4 + 10;

    while (produced < target && attempts < maxAttempts) {
      attempts++;
      const template = templates[attempts % templates.length] as QuestionTemplate;
      const vars = fillableVars(template, pools, cursor);
      if (!vars) continue;
      const text = template.build(vars);
      const normalized = text.toLowerCase().trim();
      if (seenText.has(normalized)) continue;
      seenText.add(normalized);

      questions.push({
        id: generateId("q"),
        scanId,
        question: text,
        category: template.category,
        intent: template.intent,
        location: vars.location ?? business.location,
        industry: business.industry,
        priority: template.priority,
        reason: template.reason(vars),
        valid: true,
      });
      produced++;
    }

    if (produced < target) {
      logger.warning(
        "question_generation_shortfall",
        `Could not generate ${target} questions for category "${category}" (only ${produced}); insufficient business data for this category's placeholders.`,
        { scanId },
        { category, target, produced },
      );
    }
  }

  logger.info("questions_generated", `Generated ${questions.length}/${options.count} requested questions`, { scanId }, {
    requested: options.count,
    generated: questions.length,
  });

  return questions;
}
