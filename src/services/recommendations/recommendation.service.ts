import { generateId } from "../../utils/id.js";
import type {
  CompetitorAggregate,
  CrossModelAnalysis,
  GeneratedQuestion,
  GeoScore,
  QuestionCategory,
  Recommendation,
  ResponseAnalysis,
  ScanStatistics,
} from "../../models/types.js";

interface CategoryStat {
  category: QuestionCategory;
  total: number;
  mentioned: number;
  rate: number;
  sampleResponseIds: string[];
}

function categoryBreakdown(analyses: ResponseAnalysis[], questionsById: Map<string, GeneratedQuestion>): CategoryStat[] {
  const byCategory = new Map<QuestionCategory, { total: number; mentioned: number; ids: string[] }>();
  for (const a of analyses) {
    const question = questionsById.get(a.questionId);
    if (!question) continue;
    const entry = byCategory.get(question.category) ?? { total: 0, mentioned: 0, ids: [] };
    entry.total++;
    if (a.mention.mentioned) entry.mentioned++;
    else if (entry.ids.length < 5) entry.ids.push(a.responseId);
    byCategory.set(question.category, entry);
  }
  return Array.from(byCategory.entries()).map(([category, v]) => ({
    category,
    total: v.total,
    mentioned: v.mentioned,
    rate: v.total > 0 ? v.mentioned / v.total : 0,
    sampleResponseIds: v.ids,
  }));
}

/**
 * Generates concrete, evidence-backed recommendations (section 25). Every rule
 * only fires when the underlying scan data actually shows the condition — no
 * recommendation is emitted from a guess. Each recommendation carries the
 * response IDs it was derived from so a caller can show the evidence.
 */
export function generateRecommendations(
  statistics: ScanStatistics,
  crossModel: CrossModelAnalysis,
  competitors: CompetitorAggregate[],
  analyses: ResponseAnalysis[],
  questionsById: Map<string, GeneratedQuestion>,
  geoScore: GeoScore,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const mentionRate = statistics.successfulResponses > 0 ? statistics.mentioned / statistics.successfulResponses : 0;
  const recommendationRate =
    statistics.successfulResponses > 0
      ? analyses.filter((a) => a.mention.recommended).length / statistics.successfulResponses
      : 0;

  // Rule 1: overall low mention rate.
  if (statistics.successfulResponses > 0 && mentionRate < 0.3) {
    const topCompetitor = competitors[0];
    recommendations.push({
      id: generateId("rec"),
      priority: "high",
      problem: `Het bedrijf wordt slechts in ${Math.round(mentionRate * 100)}% van de geanalyseerde AI-antwoorden genoemd.`,
      observation: topCompetitor
        ? `Concurrent "${topCompetitor.name}" wordt vaker genoemd (${topCompetitor.mentions}x) dan het bedrijf zelf (${statistics.mentioned}x).`
        : `Er zijn ${statistics.successfulResponses} bruikbare AI-antwoorden geanalyseerd waarin het bedrijf nauwelijks voorkomt.`,
      recommendation:
        "Verbeter en verbreid content die specifiek ingaat op de diensten, locatie en propositie van het bedrijf, zodat AI-systemen het bedrijf vaker als bron herkennen en noemen.",
      evidenceResponseIds: analyses.filter((a) => !a.mention.mentioned).slice(0, 5).map((a) => a.responseId),
    });
  }

  // Rule 2: category-specific gaps (mentioned overall, but not in a specific category).
  const categories = categoryBreakdown(analyses, questionsById);
  for (const cat of categories) {
    if (cat.total >= 2 && cat.rate === 0 && mentionRate > 0) {
      recommendations.push({
        id: generateId("rec"),
        priority: "medium",
        problem: `Het bedrijf wordt niet genoemd bij vragen in de categorie "${cat.category}" (0/${cat.total}).`,
        observation: `Terwijl het bedrijf gemiddeld in ${Math.round(mentionRate * 100)}% van alle antwoorden voorkomt, scoort categorie "${cat.category}" 0%.`,
        recommendation: `Maak of verbeter content die specifiek aansluit op vragen uit de categorie "${cat.category}", zodat AI-modellen het bedrijf ook in die context als relevant optie zien.`,
        evidenceResponseIds: cat.sampleResponseIds,
      });
    }
  }

  // Rule 3: high cross-model spread (inconsistent visibility between providers).
  if (crossModel.mentionRateSpread > 0.3 && crossModel.perProvider.some((p) => p.successfulResponses > 0)) {
    const best = [...crossModel.perProvider].sort((a, b) => b.mentionRate - a.mentionRate)[0];
    const worst = [...crossModel.perProvider].sort((a, b) => a.mentionRate - b.mentionRate)[0];
    recommendations.push({
      id: generateId("rec"),
      priority: "medium",
      problem: `Zichtbaarheid verschilt sterk tussen AI-modellen (spreiding: ${Math.round(crossModel.mentionRateSpread * 100)} procentpunt).`,
      observation: `${best?.provider} noemt het bedrijf in ${Math.round((best?.mentionRate ?? 0) * 100)}% van de antwoorden, terwijl ${worst?.provider} slechts ${Math.round((worst?.mentionRate ?? 0) * 100)}% haalt.`,
      recommendation:
        "Zorg voor consistente, breed gepubliceerde en gestructureerde informatie over het bedrijf (website, vermeldingen, reviews) zodat alle AI-modellen over dezelfde actuele gegevens beschikken.",
      evidenceResponseIds: [],
    });
  }

  // Rule 4: a competitor is clearly outperforming the business.
  const topCompetitor = competitors[0];
  if (topCompetitor && topCompetitor.mentions >= 3 && topCompetitor.mentions > statistics.mentioned * 1.5) {
    recommendations.push({
      id: generateId("rec"),
      priority: "high",
      problem: `Concurrent "${topCompetitor.name}" domineert de AI-antwoorden ten opzichte van het bedrijf.`,
      observation: `"${topCompetitor.name}" wordt ${topCompetitor.mentions}x genoemd over ${topCompetitor.questionIds.length} vragen, tegenover ${statistics.mentioned}x voor het bedrijf zelf.`,
      recommendation: `Analyseer waarom "${topCompetitor.name}" vaker als aanbeveling verschijnt (bijv. sterkere online aanwezigheid of reviews) en sluit dat verschil met gerichte content en linkbuilding.`,
      evidenceResponseIds: [],
    });
  }

  // Rule 5: mentioned often, but rarely actually recommended.
  if (mentionRate > 0.2 && recommendationRate < mentionRate * 0.3) {
    recommendations.push({
      id: generateId("rec"),
      priority: "medium",
      problem: "Het bedrijf wordt regelmatig genoemd, maar zelden actief aanbevolen door AI-modellen.",
      observation: `Mention rate is ${Math.round(mentionRate * 100)}%, maar de recommendation rate is slechts ${Math.round(recommendationRate * 100)}%.`,
      recommendation: "Versterk vertrouwenssignalen zoals klantbeoordelingen, cases en duidelijke unique selling points, zodat AI-modellen het bedrijf niet alleen noemen maar ook actief aanraden.",
      evidenceResponseIds: analyses.filter((a) => a.mention.mentioned && !a.mention.recommended).slice(0, 5).map((a) => a.responseId),
    });
  }

  // Rule 6: significant portion of AI requests failed, weakening scan coverage.
  if (statistics.totalResponses > 0 && statistics.failedResponses / statistics.totalResponses > 0.2) {
    recommendations.push({
      id: generateId("rec"),
      priority: "low",
      problem: "Een aanzienlijk deel van de AI-aanvragen tijdens deze scan is mislukt.",
      observation: `${statistics.failedResponses}/${statistics.totalResponses} AI-aanvragen zijn gefaald, wat de betrouwbaarheid van deze scan beperkt.`,
      recommendation: "Controleer providerconfiguratie (API keys, rate limits) en voer de scan opnieuw uit voor een vollediger beeld voordat je op deze resultaten grote beslissingen baseert.",
      evidenceResponseIds: [],
    });
  }

  if (recommendations.length === 0 && geoScore.total >= 70) {
    recommendations.push({
      id: generateId("rec"),
      priority: "low",
      problem: "Geen significante zwakke punten gevonden in deze scan.",
      observation: `GEO-score van ${geoScore.total}/100 met een mention rate van ${Math.round(mentionRate * 100)}%.`,
      recommendation: "Blijf de zichtbaarheid monitoren met periodieke scans en borg de huidige sterke content- en vermeldingsstrategie.",
      evidenceResponseIds: [],
    });
  }

  return recommendations.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function priorityRank(priority: Recommendation["priority"]): number {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}
