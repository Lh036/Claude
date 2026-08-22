# GEO System

A full-stack **Generative Engine Optimization (GEO)** platform: given a
business (name, website, industry, location), it researches the business,
generates realistic questions a potential customer might ask an AI assistant,
sends them to multiple AI providers (ChatGPT, Gemini, Claude), analyzes the
answers for mentions/position/competitors, scores the business's visibility,
and produces concrete, evidence-based recommendations — with a web UI to run
and browse all of it.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the backend pipeline
design, provider extension guide, and full API reference, and
[`frontend/README.md`](frontend/README.md) for the frontend.

## Quick start

```bash
# Backend (terminal 1)
cp .env.example .env
npm install
npm run dev

# Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. By default `GEO_ENV=test`, so the AI Query Engine
uses a deterministic network-free `MockProvider` — no API keys required to try
the full pipeline end to end, from adding a business to a completed GEO scan.

```bash
npm test          # backend unit + end-to-end tests
npm run typecheck
npm run build && npm start
```

To run against real AI providers, set `GEO_ENV=production` in `.env` and fill
in `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` as needed.
