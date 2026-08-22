import { describe, expect, it } from "vitest";
import { createBusiness } from "../src/services/business/business.service.js";
import { researchBusiness } from "../src/services/business/research.service.js";
import { generateQuestions } from "../src/services/questions/generator.service.js";
import { validateQuestions } from "../src/services/questions/validator.service.js";

function setupBusiness() {
  const business = createBusiness({
    companyName: "Amsterdam Marketing BV",
    website: "https://amsterdammarketing.nl",
    industry: "marketingbureau",
    location: "Amsterdam",
    description: "Wij helpen MKB-bedrijven met SEO, contentmarketing en social media advertising.",
    extra: { services: ["SEO", "contentmarketing", "social media advertising"], competitors: ["Bureau X", "Bureau Y"] },
  });
  const research = researchBusiness(business);
  return { business, research };
}

describe("question generator", () => {
  it("respects the configured question count", () => {
    const { business, research } = setupBusiness();
    for (const count of [7, 14, 25]) {
      const questions = generateQuestions(business, research, "scan_1", { count });
      expect(questions.length).toBeLessThanOrEqual(count);
      expect(questions.length).toBeGreaterThan(0);
    }
  });

  it("produces questions spread across multiple categories, not one pattern", () => {
    const { business, research } = setupBusiness();
    const questions = generateQuestions(business, research, "scan_1", { count: 21 });
    const categories = new Set(questions.map((q) => q.category));
    expect(categories.size).toBeGreaterThan(3);
  });

  it("includes complete metadata on every question", () => {
    const { business, research } = setupBusiness();
    const questions = generateQuestions(business, research, "scan_1", { count: 14 });
    for (const q of questions) {
      expect(q.id).toBeTruthy();
      expect(q.question.length).toBeGreaterThan(5);
      expect(q.category).toBeTruthy();
      expect(q.intent).toBeTruthy();
      expect(q.priority).toBeTruthy();
      expect(q.reason.length).toBeGreaterThan(0);
    }
  });

  it("grounds questions in real business data (service/location terms present)", () => {
    const { business, research } = setupBusiness();
    const questions = generateQuestions(business, research, "scan_1", { count: 14 });
    const validated = validateQuestions(questions, business, research);
    const invalid = validated.filter((q) => !q.valid);
    expect(invalid.length).toBe(0);
  });

  it("rejects a non-positive count", () => {
    const { business, research } = setupBusiness();
    expect(() => generateQuestions(business, research, "scan_1", { count: 0 })).toThrow();
  });

  it("does not fabricate placeholders when no competitor data exists", () => {
    const business = createBusiness({ companyName: "Solo Studio", industry: "webdesign" });
    const research = researchBusiness(business);
    const questions = generateQuestions(business, research, "scan_1", { count: 20 });
    const comparisonQuestions = questions.filter((q) => q.category === "comparison");
    expect(comparisonQuestions.length).toBe(0); // no competitor data -> template skipped, not filled with filler text
  });
});
