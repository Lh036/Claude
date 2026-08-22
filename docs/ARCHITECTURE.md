# GEO System Architecture

This backend answers one question, automatically and repeatably: **how visible is
a business in AI-generated answers, across multiple AI providers?**

This document covers the backend (`src/`). The frontend (`frontend/`) is a
separate Vite/React app that consumes the API described below — see
`frontend/README.md` for its own architecture notes.

## Stack

- **Runtime:** Node.js 18+, TypeScript (ESM, strict mode)
- **HTTP:** Express
- **Storage:** SQLite via `better-sqlite3` (single file, zero external infra)
- **Validation:** Zod at the API boundary
- **Tests:** Vitest

No external queue/broker, no ORM. The project was greenfield (empty repo) so the
stack was chosen for "runs anywhere with `npm install`, no Docker/Redis/Postgres
required" while keeping every seam (storage, queue, providers) behind an
interface that a heavier stack can replace later without touching pipeline logic.

## Pipeline

```
Input (Business)
  -> Business Research            services/business/research.service.ts
  -> Question Generator           services/questions/generator.service.ts
  -> Question Validation          services/questions/validator.service.ts
  -> AI Query Engine              providers/*, queue/aiQueryQueue.ts
       (OpenAI | Gemini | Claude, uniform AIProvider interface)
  -> Response Collection          db/response.repository.ts
  -> Response Analysis            services/analysis/responseAnalyzer.service.ts
       - Mention Detection        services/analysis/mentionDetection.service.ts
       - Position Analysis        services/analysis/positionAnalysis.service.ts
       - Context Analysis         services/analysis/contextAnalysis.service.ts
       - Competitor Detection     services/analysis/competitorDetection.service.ts
  -> Cross-Model Comparison       services/crossmodel/crossModelAnalysis.service.ts
  -> GEO Scoring                  services/scoring/geoScore.service.ts
  -> Recommendations              services/recommendations/recommendation.service.ts
  -> Final Report Data            services/scan/scanService.ts (getScanResult)
```

Every stage is a **pure(ish) function or a small service module** that takes
typed input (from `src/models/types.ts`) and returns typed output. Each one can
be — and is, see `tests/` — unit tested in isolation, independent of the others.
The orchestrator (`services/scan/scanOrchestrator.service.ts`) is the only piece
that wires them together in sequence.

## How a scan runs

1. `POST /api/scans` (`scanService.createScan`) validates the business exists,
   creates a `scans` row with `status="pending"`, and schedules
   `scanOrchestrator.runScan(scanId)` to run in the background
   (`queueMicrotask`, fire-and-forget). The HTTP call returns immediately with
   the scan id.
2. `runScan` moves the scan through `stage` values (`research` ->
   `question_generation` -> `question_validation` -> `ai_querying` ->
   `response_analysis` -> `competitor_detection` -> `cross_model_analysis` ->
   `scoring` -> `recommendations` -> `done`), persisting after each stage.
3. Callers poll `GET /api/scans/:id/status` (or `/result` for the full payload)
   to watch progress — there is no websocket/streaming layer, by design, to
   keep the surface area small.
4. Final `status` is one of `completed` (no errors), `partial` (some AI
   requests/analysis steps failed but at least one response succeeded), or
   `failed` (nothing usable came out, e.g. no valid questions or a business
   research crash before any AI query ran).

### Why an in-process scheduler instead of a real job queue

Section 19 of the brief asks for a "job/task-based architecture" rather than one
giant synchronous function. `runScan` **is** that: a sequence of independently
callable, independently testable stages, each of which persists its own output
before moving on. What it is *not* is backed by an external broker (BullMQ,
SQS, ...) — there was no existing queue infrastructure in this repo to plug
into, and adding Redis/BullMQ as a hard dependency for a project that has to
"run anywhere" seemed like the wrong trade-off. The concurrency/rate-limiting
that matters most (the AI Query Engine, which fires many requests per scan) has
its own real per-provider limiter (`queue/rateLimitedQueue.ts`) independent of
the outer scheduler.

If this needs to scale beyond one process, the swap point is exactly
`scanService.scheduleScan()`: replace the `queueMicrotask` call with
`queue.add('run-scan', { scanId })` against a real broker, and have a worker
call `runScan(scanId)` — no pipeline code changes required.

## Provider abstraction

`src/providers/types.ts` defines the single contract every provider implements:

```ts
interface AIProvider {
  name: ProviderName;      // "openai" | "gemini" | "anthropic" | "mock"
  model: string;
  isConfigured(): boolean;
  runQuery(question: string): Promise<ProviderQueryResult>;
}
```

`ProviderQueryResult` is the same shape regardless of provider: `provider`,
`model`, `question`, `answer`, `timestamp`, `durationMs`, `status`, `error`,
`usage` (token counts + estimated cost). Nothing downstream of the provider
layer (queue, analysis, scoring) knows or cares which concrete provider it came
from beyond that string tag.

Implementations:

- `openai.provider.ts` — OpenAI Chat Completions API (fetch-based, no SDK dep)
- `gemini.provider.ts` — Google Generative Language API
- `anthropic.provider.ts` — Anthropic Messages API
- `mock.provider.ts` — deterministic, network-free, used whenever `GEO_ENV=test`
  (see below)

### Adding a new provider

1. Implement `AIProvider` in `src/providers/<name>.provider.ts` (model the HTTP
   call on `openai.provider.ts` — use `postJson` from `httpClient.ts` for
   consistent timeout/error handling).
2. Add its config block to `src/config/index.ts` (`ProviderConfig` + env vars)
   and `.env.example`.
3. Register it in `src/providers/registry.ts` (`createRealProvider`) and add its
   name to `ProviderName` in `src/models/types.ts` and
   `allSupportedProviderNames()`.

No other file needs to change — the queue, analysis, scoring, and API layers
are provider-agnostic by construction.

## Test mode vs. production mode (section 30)

`GEO_ENV` controls this everywhere:

- `GEO_ENV=test` (default): `providers/registry.ts` backs **every** requested
  provider with `MockProvider`, regardless of which API keys are set. Mock
  responses are clearly tagged `provider: "mock"` in the stored `AIResponse` —
  they are never presented as if they came from a real model.
- `GEO_ENV=production`: real providers are used. If a specific provider has no
  API key configured, that provider falls back to `MockProvider` for that scan
  (rather than crashing the whole scan) and a `WARNING` log records exactly
  that this happened — again tagged `provider: "mock"` in the response so a
  report consumer can tell which numbers are real AI output and which are not.

This is the hard boundary the brief asks for: mock data can end up in a
"production" scan's report only when a key is genuinely missing, and it is
always visibly labeled, never silently blended in as if it were a real answer.

## GEO score

`services/scoring/geoScore.service.ts` computes a 0-100 score as a **documented,
weighted sum of six components**, each also 0-100:

| Component | Weight | What it measures |
|---|---|---|
| Mention rate | 30% | Share of successful AI responses that mention the business |
| Position | 20% | How high the business ranks when a response contains a list (0 if never ranked) |
| Recommendation rate | 20% | Share of responses that don't just mention but actively recommend |
| Competitor visibility | 10% | Business's share of voice vs. every competitor detected in the scan |
| Cross-model visibility | 10% | Average mention rate across providers, penalized for inconsistency between them |
| Query coverage | 10% | How much of the intended question x provider matrix actually got a real answer |

The weights live in `GEO_SCORE_WEIGHTS`, a single exported constant — retuning
the formula means editing that object, not the calculation logic. The function
is pure (no randomness, no hidden state), so identical scan data always
reproduces an identical score (see `tests/geoScore.test.ts`).

## Recommendations

`services/recommendations/recommendation.service.ts` is rule-based, not
generative: each rule inspects the scan's actual statistics/cross-model/
competitor data and only fires — with a `problem` / `observation` /
`recommendation`, plus the evidence response IDs it was derived from — when the
underlying condition is actually true. No rule invents a problem the data
doesn't show.

## Error handling & resilience (sections 19-22)

- Every AI request goes through `queue/aiQueryQueue.ts`, which wraps
  `provider.runQuery` in `queue/retry.ts`'s exponential-backoff retry. Only
  errors marked `retryable: true` in `providers/errors.ts` (timeout, rate
  limit, empty response, provider unavailable, network error) are retried;
  permanent errors (bad credentials, malformed request, parsing failure) fail
  on the first attempt.
- Per-provider concurrency and requests-per-minute are enforced by
  `queue/rateLimitedQueue.ts`, configured per provider via env vars
  (`OPENAI_MAX_CONCURRENT`, `OPENAI_REQUESTS_PER_MINUTE`, etc. — see
  `.env.example`).
- A single question/provider failure never aborts the batch: `runAiQueries`
  catches everything per-request, stores a `status: "failed"` `AIResponse`
  with the classified error, and keeps going. The scan orchestrator does the
  same at the analysis/competitor-detection stages.
- The scan's final `status` reflects this: `completed` (zero errors),
  `partial` (some errors, but at least one successful response — the normal
  "43 succeeded, 2 failed" case from the brief), or `failed` (nothing usable).

## Logging (section 29)

`src/logging/logger.ts` emits structured entries (`timestamp`, `level`, `event`,
`scanId`, `questionId`, `provider`, `message`, `metadata`) at `DEBUG` / `INFO` /
`SUCCESS` / `WARNING` / `ERROR`. The server wires a `CompositeDbSink` that
writes every entry to stdout **and** to the `logs` table (`db/log.repository.ts`),
so scan-scoped logs are queryable later without grepping process output.

## Data model

See `src/models/types.ts` for the full set of shared types and
`src/db/connection.ts` for the SQLite schema. Every entity from the brief has a
table: `businesses`, `business_research`, `scans`, `questions`, `responses`,
`response_analyses`, `competitors`, `recommendations`, `scan_results`
(cross-model + GEO score + statistics), `logs`.

`businesses.extra_json` is a free-form JSON bag specifically so new business
fields (section 3: "make the system extensible") don't require a schema
migration — add a key, read it via `business.extra.yourField`.

## Running locally

```bash
cp .env.example .env      # GEO_ENV=test by default — no API keys needed
npm install
npm run dev                # starts the API on GEO_PORT (default 3000)
npm test                   # unit + end-to-end pipeline tests (mock providers)
npm run typecheck
```

To use real providers, set `GEO_ENV=production` and fill in the API keys for
whichever providers you want in `.env` (a provider without a key falls back to
mock for that scan, with a warning logged — it won't crash the scan).

### Example scan via the API

```bash
curl -X POST localhost:3000/api/businesses -H 'Content-Type: application/json' -d '{
  "companyName": "Amsterdam Marketing BV",
  "website": "https://amsterdammarketing.nl",
  "industry": "marketingbureau",
  "location": "Amsterdam",
  "description": "Wij helpen MKB-bedrijven met SEO, contentmarketing en social media advertising.",
  "extra": { "services": ["SEO", "contentmarketing"], "competitors": ["Bureau Noord"] }
}'
# => { "id": "biz_...", ... }

curl -X POST localhost:3000/api/scans -H 'Content-Type: application/json' -d '{
  "businessId": "biz_...",
  "questionCount": 25
}'
# => { "id": "scan_...", "status": "pending", ... }

curl localhost:3000/api/scans/scan_.../status
curl localhost:3000/api/scans/scan_.../result   # full ScanResult once completed/partial
```

## API surface (section 27)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/businesses` | Create a business |
| GET | `/api/businesses` | List businesses |
| GET | `/api/businesses/:id` | Get a business |
| PATCH | `/api/businesses/:id` | Update a business |
| GET | `/api/businesses/:id/scans` | List scans for a business |
| POST | `/api/scans` | Create + start a scan |
| GET | `/api/scans` | List scans across all businesses (filter by `businessId`/`status`), each enriched with its `geoScore`/`statistics` |
| GET | `/api/scans/:id` | Get scan (full row incl. status/stage/errors) |
| GET | `/api/scans/:id/status` | Lightweight status poll |
| GET | `/api/scans/:id/questions` | Generated questions |
| GET | `/api/scans/:id/responses` | Raw AI responses |
| GET | `/api/scans/:id/analysis` | Per-response analysis |
| GET | `/api/scans/:id/competitors` | Aggregated competitor dataset |
| GET | `/api/scans/:id/recommendations` | Recommendations |
| GET | `/api/scans/:id/statistics` | Scan statistics summary |
| GET | `/api/scans/:id/result` | Full `ScanResult` (everything above, combined) |
| GET | `/api/logs` | Query the `logs` table — filters: `scanId`, `level`, `provider`, `event`, `q` (search), `limit`, `offset`, `order`. Powers the frontend's Logs/Errors/Activity views and the per-run timeline; there is no separate errors/runs resource. |

This is the layer the frontend (`frontend/`, see `frontend/README.md`) consumes.
CORS is open (`src/api/app.ts`) since the frontend is a separate deployable with
no cookie-based auth to protect.
