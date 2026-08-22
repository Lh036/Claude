import { describe, expect, it } from "vitest";
import { detectMention } from "../src/services/analysis/mentionDetection.service.js";
import { generateNameVariants } from "../src/utils/nameVariants.js";

describe("mention detection", () => {
  const variants = generateNameVariants("Amsterdam Marketing BV", "https://amsterdammarketing.nl");

  it("detects the full company name", () => {
    const result = detectMention("Amsterdam Marketing BV is een goede keuze voor SEO.", variants);
    expect(result.mentioned).toBe(true);
    expect(result.occurrences).toBeGreaterThanOrEqual(1);
  });

  it("detects the name without legal suffix", () => {
    const result = detectMention("Amsterdam Marketing biedt uitstekende diensten.", variants);
    expect(result.mentioned).toBe(true);
  });

  it("detects the domain as a mention", () => {
    const result = detectMention("Kijk eens op amsterdammarketing.nl voor meer info.", variants);
    expect(result.mentioned).toBe(true);
  });

  it("does not falsely match an unrelated company", () => {
    const result = detectMention("Rotterdam Digital en Utrecht Media zijn goede opties.", variants);
    expect(result.mentioned).toBe(false);
    expect(result.occurrences).toBe(0);
  });

  it("does not match inside a longer unrelated compound word", () => {
    const result = detectMention("AmsterdamMarketingGroup biedt heel andere diensten dan wij.", variants);
    expect(result.mentioned).toBe(false);
  });

  it("marks a mention as recommended when recommendation language surrounds it", () => {
    const result = detectMention("Wij raden Amsterdam Marketing BV sterk aan voor jouw SEO-strategie.", variants);
    expect(result.mentioned).toBe(true);
    expect(result.recommended).toBe(true);
  });

  it("does not invent a recommendation when the mention is neutral", () => {
    const result = detectMention("Amsterdam Marketing BV is een van de bureaus in de stad.", variants);
    expect(result.mentioned).toBe(true);
    expect(result.recommended).toBe(false);
  });

  it("counts multiple occurrences", () => {
    const result = detectMention("Amsterdam Marketing BV is goed. Later in het antwoord noemen we Amsterdam Marketing BV nogmaals.", variants);
    expect(result.occurrences).toBe(2);
  });
});
