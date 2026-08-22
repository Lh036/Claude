# GEO System

Backend for automated **Generative Engine Optimization (GEO)** analysis: given a
business (name, website, industry, location), it researches the business,
generates realistic questions a potential customer might ask an AI assistant,
sends them to multiple AI providers (ChatGPT, Gemini, Claude), analyzes the
answers for mentions/position/competitors, scores the business's visibility,
and produces concrete, evidence-based recommendations.

No dashboard is included — this is the backend/API/data layer a frontend would
sit on top of. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full
pipeline design, provider extension guide, and API reference.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

By default `GEO_ENV=test`, so the AI Query Engine uses a deterministic
network-free `MockProvider` — no API keys required to try the full pipeline.

```bash
npm test          # unit + end-to-end tests
npm run typecheck
npm run build && npm start
```

To run against real AI providers, set `GEO_ENV=production` in `.env` and fill
in `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` as needed.
