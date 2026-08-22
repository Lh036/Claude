import { describe, expect, it } from "vitest";
import { aggregateCompetitors } from "../src/services/analysis/competitorDetection.service.js";
import { analyzeCrossModel } from "../src/services/crossmodel/crossModelAnalysis.service.js";
import type { AIResponse, GeneratedQuestion, ResponseAnalysis } from "../src/models/types.js";

function makeAnalysis(overrides: Partial<ResponseAnalysis>): ResponseAnalysis {
  return {
    id: `an_${Math.random()}`,
    scanId: "scan_1",
    responseId: `resp_${Math.random()}`,
    questionId: "q_1",
    provider: "openai",
    mention: { mentioned: false, occurrences: 0, matchedVariants: [], recommended: false },
    position: { hasRanking: false, position: null, totalCompaniesMentioned: null, relativePosition: null },
    context: { servicesM: [], strengths: [], weaknesses: [], audienceMentioned: [], locationMentioned: [], attributes: [], surroundingText: null },
    competitorsDetected: [],
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<GeneratedQuestion>): GeneratedQuestion {
  return {
    id: "q_1",
    scanId: "scan_1",
    question: "Wat zijn goede opties?",
    category: "recommendation",
    intent: "commercial",
    location: "Amsterdam",
    industry: "marketing",
    priority: "high",
    reason: "test",
    valid: true,
    ...overrides,
  };
}

function makeResponse(overrides: Partial<AIResponse>): AIResponse {
  return {
    id: `resp_${Math.random()}`,
    scanId: "scan_1",
    questionId: "q_1",
    provider: "openai",
    model: "test-model",
    question: "Wat zijn goede opties?",
    answer: "1. Bureau X\n2. Bureau Y",
    timestamp: new Date().toISOString(),
    durationMs: 10,
    status: "success",
    error: null,
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, estimatedCostUsd: 0 },
    attempt: 1,
    ...overrides,
  };
}

describe("competitor aggregation", () => {
  it("combines mentions of the same competitor across multiple responses", () => {
    const questionsById = new Map([["q_1", makeQuestion({})], ["q_2", makeQuestion({ id: "q_2", category: "best_of" })]]);
    const analyses = [
      makeAnalysis({ questionId: "q_1", provider: "openai", competitorsDetected: [{ name: "Bureau X", position: 1 }] }),
      makeAnalysis({ questionId: "q_2", provider: "gemini", competitorsDetected: [{ name: "Bureau X", position: 2 }] }),
      makeAnalysis({ questionId: "q_1", provider: "openai", competitorsDetected: [{ name: "Bureau Y", position: 3 }] }),
    ];

    const competitors = aggregateCompetitors(analyses, questionsById);
    const bureauX = competitors.find((c) => c.name === "Bureau X");
    expect(bureauX).toBeDefined();
    expect(bureauX?.mentions).toBe(2);
    expect(bureauX?.averagePosition).toBeCloseTo(1.5);
    expect(bureauX?.providers.openai).toBe(1);
    expect(bureauX?.providers.gemini).toBe(1);
    expect(bureauX?.categories.sort()).toEqual(["best_of", "recommendation"]);
    expect(competitors[0]?.name).toBe("Bureau X"); // sorted by mentions desc
  });

  it("returns an empty array when no competitors were detected", () => {
    const competitors = aggregateCompetitors([makeAnalysis({})], new Map());
    expect(competitors).toEqual([]);
  });
});

describe("cross-model analysis", () => {
  it("computes per-provider mention rate and spread", () => {
    const responses = [
      makeResponse({ id: "r1", provider: "openai", status: "success" }),
      makeResponse({ id: "r2", provider: "gemini", status: "success" }),
      makeResponse({ id: "r3", provider: "anthropic", status: "success" }),
    ];
    const analyses = [
      makeAnalysis({ responseId: "r1", provider: "openai", mention: { mentioned: true, occurrences: 1, matchedVariants: ["x"], recommended: true } }),
      makeAnalysis({ responseId: "r2", provider: "gemini", mention: { mentioned: false, occurrences: 0, matchedVariants: [], recommended: false } }),
      makeAnalysis({ responseId: "r3", provider: "anthropic", mention: { mentioned: true, occurrences: 1, matchedVariants: ["x"], recommended: false } }),
    ];

    const result = analyzeCrossModel(responses, analyses);
    const openai = result.perProvider.find((p) => p.provider === "openai");
    const gemini = result.perProvider.find((p) => p.provider === "gemini");

    expect(openai?.mentionRate).toBe(1);
    expect(gemini?.mentionRate).toBe(0);
    expect(result.mentionRateSpread).toBeCloseTo(1);
  });

  it("counts failed responses separately from successful ones", () => {
    const responses = [
      makeResponse({ id: "r1", provider: "openai", status: "success" }),
      makeResponse({ id: "r2", provider: "openai", status: "failed", answer: null }),
    ];
    const analyses = [makeAnalysis({ responseId: "r1", provider: "openai", mention: { mentioned: true, occurrences: 1, matchedVariants: ["x"], recommended: false } })];

    const result = analyzeCrossModel(responses, analyses);
    const openai = result.perProvider.find((p) => p.provider === "openai");
    expect(openai?.successfulResponses).toBe(1);
    expect(openai?.failedResponses).toBe(1);
    expect(openai?.totalQuestions).toBe(2);
  });
});
