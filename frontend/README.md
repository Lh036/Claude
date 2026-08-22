# GEO Frontend

The web interface for the GEO backend: add businesses, configure and start GEO
scans, follow live progress, and browse every result the backend produces —
questions, AI responses, mentions, competitors, provider comparisons, GEO
scores, recommendations, runs, logs, errors, and activity.

This is purely a client for the existing backend API (`../src`). It contains
no GEO business logic of its own — every number on screen comes from a real
`/api/*` endpoint.

## Stack

React 18 + TypeScript, Vite, Tailwind CSS v4, TanStack Query v5 (data
fetching, caching, polling), react-router-dom v6, recharts (the two charts
that earn their place: mention-rate-by-provider, GEO score breakdown),
lucide-react icons.

## Running locally

The backend must be running first (see `../README.md` — `GEO_ENV=test` needs
no API keys):

```bash
# terminal 1, from the repo root
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

Vite proxies `/api/*` to `http://localhost:3000` in dev (`vite.config.ts`), so
the frontend always calls relative `/api/...` URLs — no `VITE_API_BASE_URL` to
configure. Open http://localhost:5173.

```bash
npm run typecheck
npm run build     # tsc --noEmit && vite build -> dist/
```

## Structure

```
src/
  lib/            API client (api.ts), shared types mirroring the backend,
                  formatting helpers, localStorage-backed scan defaults
  hooks/          useBusinessMap (id -> Business lookup), useScanStatus
                  (polls GET /scans/:id/status while active)
  components/ui/  Design system primitives (Button, Card, Table, Badge,
                  Tabs, Modal, Skeleton, EmptyState, ErrorState, Field, Toast)
  components/business/  AddBusinessModal
  components/scan/      StartScanModal, ScanProgress, RunTimeline,
                         ScoreGauge, VisibilityPanel, QuestionsPanel,
                         ResponsesPanel, CompetitorsTable, ProviderComparison,
                         RecommendationsList, ScanErrorsPanel, ScansTable
  components/layout/    AppShell, Sidebar, Topbar
  pages/          One file per route (see src/App.tsx for the route table)
```

## Design notes

- **Runs vs. Scans**: a "run" is the same underlying entity as a "scan" — one
  scan execution IS one pipeline run. `/runs` and `/runs/:id` present that
  same data through an execution-status lens (timing, request success/failure
  counts, a real event timeline); `/scans` and `/scans/:id` present it through
  a GEO-results lens (score, visibility, competitors, recommendations). There
  is no separate backend "runs" resource.
- **Errors and Activity are both views over the `logs` table**
  (`GET /api/logs`), not separate backend resources: Errors is
  `level=ERROR`; Activity is a curated subset of real event names (grepped
  from the backend's actual `logger.*` call sites) with high-frequency
  per-request noise filtered out client-side.
- **No fake functionality**: every filter/search control fires a real API
  query; the Errors page has no fabricated "resolve" workflow since the
  backend doesn't track one; Settings only exposes the two things that
  actually change behavior (default question count / providers for the Start
  Scan dialog), stored in `localStorage` since there's no backend settings
  API to back a "saved server-side" claim.
- **Live progress**: `ScanProgress` derives its checklist strictly from
  `scan.stage` and `scan.errors[].stage` — it never marks a stage "done" that
  the backend didn't actually reach (an early hard failure, e.g. "no valid
  questions", stops the checklist at the real failure point instead of
  showing every step as complete just because the orchestrator returned).
