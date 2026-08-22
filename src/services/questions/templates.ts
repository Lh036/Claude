import type { QuestionCategory, QuestionPriority, SearchIntent } from "../../models/types.js";

/**
 * A template's `build` fills the human-readable question text and a short reason
 * explaining why it was generated (used later as question metadata). `placeholders`
 * declares what data the template needs so the generator can skip templates it
 * cannot fill with real business data instead of falling back to filler text.
 */
export interface QuestionTemplate {
  category: QuestionCategory;
  intent: SearchIntent;
  priority: QuestionPriority;
  placeholders: Array<"service" | "location" | "competitor" | "problem" | "niche">;
  build: (vars: { service?: string; location?: string; competitor?: string; problem?: string; niche?: string }) => string;
  reason: (vars: { service?: string; location?: string; competitor?: string; problem?: string; niche?: string }) => string;
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  // Category 1 — Recommendations
  {
    category: "recommendation",
    intent: "commercial",
    priority: "high",
    placeholders: ["service", "location"],
    build: ({ service, location }) => `Wat zijn goede ${service} bedrijven in ${location}?`,
    reason: ({ service, location }) => `Klanten die "${service}" zoeken in "${location}" gebruiken vaak deze zoekvraag.`,
  },
  {
    category: "recommendation",
    intent: "commercial",
    priority: "high",
    placeholders: ["service"],
    build: ({ service }) => `Kun je een aantal betrouwbare aanbieders van ${service} aanraden?`,
    reason: ({ service }) => `Directe aanbevelingsvraag voor de dienst "${service}".`,
  },

  // Category 2 — Comparisons
  {
    category: "comparison",
    intent: "commercial",
    priority: "high",
    placeholders: ["competitor"],
    build: ({ competitor }) => `Welke bedrijven zijn goede alternatieven voor ${competitor}?`,
    reason: ({ competitor }) => `Vergelijkt de doelgroep het bedrijf actief met concurrent "${competitor}".`,
  },
  {
    category: "comparison",
    intent: "commercial",
    priority: "medium",
    placeholders: ["service", "competitor"],
    build: ({ service, competitor }) => `Wat zijn de verschillen tussen ${competitor} en andere ${service} aanbieders?`,
    reason: ({ competitor }) => `Onderzoekt hoe het bedrijf zich onderscheidt van "${competitor}".`,
  },

  // Category 3 — Best-of Queries
  {
    category: "best_of",
    intent: "commercial",
    priority: "high",
    placeholders: ["service", "location"],
    build: ({ service, location }) => `Wat zijn de beste ${service} aanbieders in ${location}?`,
    reason: ({ service, location }) => `Best-of vraag voor "${service}" in "${location}", een veelgebruikt zoekpatroon.`,
  },
  {
    category: "best_of",
    intent: "commercial",
    priority: "medium",
    placeholders: ["service"],
    build: ({ service }) => `Wat is momenteel de beste keuze voor ${service}?`,
    reason: ({ service }) => `Algemene best-of vraag zonder locatie-restrictie voor "${service}".`,
  },

  // Category 4 — Problem-based Queries
  {
    category: "problem_based",
    intent: "commercial",
    priority: "high",
    placeholders: ["problem"],
    build: ({ problem }) => `Ik zoek een bedrijf dat mij kan helpen met ${problem}. Welke bedrijven raad je aan?`,
    reason: ({ problem }) => `Probleemgerichte vraag afgeleid van propositie "${problem}".`,
  },
  {
    category: "problem_based",
    intent: "commercial",
    priority: "medium",
    placeholders: ["problem"],
    build: ({ problem }) => `Welke oplossingen zijn er voor ${problem}?`,
    reason: ({ problem }) => `Bredere probleemvraag rond "${problem}".`,
  },

  // Category 5 — Local Queries
  {
    category: "local",
    intent: "commercial",
    priority: "high",
    placeholders: ["service", "location"],
    build: ({ service, location }) => `Welke ${service} aanbieders zijn goed in ${location}?`,
    reason: ({ service, location }) => `Lokale zoekvraag gericht op "${location}" voor "${service}".`,
  },
  {
    category: "local",
    intent: "commercial",
    priority: "medium",
    placeholders: ["service", "location"],
    build: ({ service, location }) => `Ken je lokale ${service} bedrijven in de buurt van ${location}?`,
    reason: ({ location }) => `Variant van de lokale zoekvraag gericht op de omgeving van "${location}".`,
  },

  // Category 6 — Industry Queries
  {
    category: "industry",
    intent: "informational",
    priority: "medium",
    placeholders: ["niche"],
    build: ({ niche }) => `Welke bedrijven zijn gespecialiseerd in ${niche}?`,
    reason: ({ niche }) => `Sectorvraag gericht op de niche "${niche}".`,
  },
  {
    category: "industry",
    intent: "informational",
    priority: "low",
    placeholders: ["niche"],
    build: ({ niche }) => `Wie zijn de belangrijkste spelers binnen ${niche}?`,
    reason: ({ niche }) => `Onderzoekt marktleiders binnen de niche "${niche}".`,
  },

  // Category 7 — Buyer Intent
  {
    category: "buyer_intent",
    intent: "informational",
    priority: "medium",
    placeholders: ["service"],
    build: ({ service }) => `Waar moet ik op letten bij het kiezen van een ${service}?`,
    reason: ({ service }) => `Oriënterende koopvraag vlak voor een beslissing over "${service}".`,
  },
  {
    category: "buyer_intent",
    intent: "informational",
    priority: "low",
    placeholders: ["service"],
    build: ({ service }) => `Wat zijn belangrijke criteria om een goede ${service} te herkennen?`,
    reason: ({ service }) => `Ondersteunt de afwegingsfase van de koopreis voor "${service}".`,
  },
];
