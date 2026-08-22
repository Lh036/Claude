import { describe, expect, it } from "vitest";
import { analyzePosition } from "../src/services/analysis/positionAnalysis.service.js";
import { extractRankedListItems } from "../src/services/analysis/listExtraction.js";
import { generateNameVariants } from "../src/utils/nameVariants.js";

describe("position analysis", () => {
  const variants = generateNameVariants("Amsterdam Marketing BV");

  it("finds the correct position in a numbered ranking", () => {
    const answer = [
      "Hier zijn een paar aanraders:",
      "1. Bureau X - sterk in branding",
      "2. Amsterdam Marketing BV - sterk in SEO",
      "3. Bureau Y - betaalbaar",
    ].join("\n");
    const items = extractRankedListItems(answer);
    const result = analyzePosition(variants, items);
    expect(result.hasRanking).toBe(true);
    expect(result.position).toBe(2);
    expect(result.totalCompaniesMentioned).toBe(3);
    expect(result.relativePosition).toBeCloseTo(2 / 3);
  });

  it("does not invent a position when there is no ranking structure", () => {
    const answer = "Amsterdam Marketing BV is een prima keuze voor SEO-diensten in de stad.";
    const items = extractRankedListItems(answer);
    const result = analyzePosition(variants, items);
    expect(result.hasRanking).toBe(false);
    expect(result.position).toBeNull();
    expect(result.totalCompaniesMentioned).toBeNull();
    expect(result.relativePosition).toBeNull();
  });

  it("reports hasRanking true but position null when the business isn't in the list", () => {
    const answer = ["1. Bureau X - sterk merk", "2. Bureau Y - betaalbaar", "3. Bureau Z - lokaal"].join("\n");
    const items = extractRankedListItems(answer);
    const result = analyzePosition(variants, items);
    expect(result.hasRanking).toBe(true);
    expect(result.position).toBeNull();
    expect(result.totalCompaniesMentioned).toBe(3);
  });

  it("requires at least two list items to count as a ranking", () => {
    const answer = "1. Amsterdam Marketing BV is de enige aanrader hier.";
    const items = extractRankedListItems(answer);
    expect(items).toHaveLength(0);
    const result = analyzePosition(variants, items);
    expect(result.hasRanking).toBe(false);
  });
});
