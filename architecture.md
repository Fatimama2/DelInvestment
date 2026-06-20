# Architecture

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web  (Vite + React + TS)                                     │
│  phone-styled UI · green/black/white · night mode · 3D nav         │
│                                                                    │
│   screens ──► lib/api.ts (PsxApi)                                  │
│                  │                                                 │
│        ┌─────────┴───────────┐                                    │
│        ▼                     ▼                                     │
│   HttpApi (fetch)       LocalApi (in-browser fallback)            │
│        │                     │  uses @psx/integrations DataService │
└────────┼─────────────────────┼────────────────────────────────────┘
         │ REST/JSON           │ (same logic, runs in the browser)
         ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  apps/backend  (Express + TS)                                      │
│   routes.ts ──► DataService ──► provider interfaces                │
│   assistant.ts (Anthropic tools + RAG + guardrails)               │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  packages/integrations   interfaces + MOCK adapters + DataService  │
│   MarketData · BrokerOms · Depository(CDC) · Clearing(NCCPL)       │
│   · Payment(Raast/IBFT) · Identity   ──►  MockStore (in-memory)    │
└──────────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  packages/shared   types · fee/tax config · i18n · theme · seed    │
│   instruments · candles · news · demo user · decks · knowledge     │
│   computePortfolio · estimateTradeCosts                            │
└──────────────────────────────────────────────────────────────────┘
```

## Packages

- **`packages/shared`** — framework-agnostic core: domain `types`, the **config-driven
  fee/tax** module (`config.ts` + `fees.ts`), `i18n` (en/ur), `theme` tokens, pure
  `computePortfolio`, and all **seed data** (≈30 instruments, deterministic candle series,
  news/announcements, the demo user, flashcard decks, and the RAG knowledge base).
- **`packages/integrations`** — the **interfaces** every external system is expressed
  through, the **MOCK adapters** that implement them against an in-memory `MockStore`, and
  the high-level **`DataService`** that the backend and the web fallback both use. Because
  `DataService` only depends on the interfaces, swapping a real provider is a one-line change
  in `providers.ts`.
- **`apps/backend`** — thin Express layer: `routes.ts` (REST), `assistant.ts` (AI),
  `rag.ts` (retrieval), `services.ts` (single `DataService` instance), `env.ts` (loads
  `.env`).
- **`apps/web`** — the UI. `lib/api.ts` exposes one `PsxApi` and picks an implementation at
  startup: **HttpApi** (talk to the backend) when `/api/health` responds, otherwise
  **LocalApi** (run the same `DataService` in the browser) so the app is always usable.

## Request flow

1. A screen calls `api.getPortfolio()` (etc.).
2. `HttpApi` → `GET /api/portfolio` → `routes.ts` → `dataService.getPortfolio()`.
3. `DataService` asks the **mock providers** for holdings (CDC), quotes (MarketData) and
   cash (Payment), then runs the **pure** `computePortfolio()` from `@psx/shared`.
4. The same `computePortfolio()` runs in the browser fallback, so numbers are identical.

## AI assistant

`apps/backend/src/assistant.ts`:

1. **Retrieve (RAG).** `rag.ts` builds an in-memory cosine-similarity store over the
   knowledge base, news/announcements and company profiles, using dependency-free
   feature-hashed term-frequency vectors. Top hits are injected into the system prompt as
   **untrusted reference data**.
2. **Reason + act (tools).** Claude is given live-data tools (`get_portfolio`,
   `get_balances`, `get_quote`, `get_watchlist`, `get_orders`, `get_account_context`,
   `search_instruments`, `get_news`) and action tools (`launch_flashcards`,
   `open_order_ticket`, `open_funding`). The tool-use loop runs the tools against
   `DataService` and feeds results back until the model produces a final answer. **Every
   tool call is logged.**
3. **Guard (in code).** A post-filter softens any recommendation-style phrasing and injects
   the not-advice disclosure; numbers come only from tool results; the assistant can never
   place orders or move money (it only returns deep-link **actions**).
4. **Offline mode.** With no `ANTHROPIC_API_KEY`, an intent-based responder still answers
   portfolio/balance/news/how-to questions from the same tools + RAG, launches flashcards,
   and refuses personalized advice.

## Mock → real swap path

1. Implement the relevant interface from `packages/integrations/src/interfaces.ts` against
   the real, credentialed API (e.g. a `KatsMarketData` or a real `NccplClearing`).
2. Return it from `createMockProviders()` in
   `packages/integrations/src/providers.ts` (rename to `createProviders()` and branch on
   env). Nothing in the routes, services, assistant or UI changes — they depend only on the
   interface.
3. Replace the in-memory `MockStore` with the real datastore (the brief suggested SQLite via
   Prisma) behind the same `DataService` methods.
4. Swap the RAG store for real embeddings + a vector DB by replacing `buildRagStore()` in
   `apps/backend/src/rag.ts` (the `RagStore` interface stays the same).

## Front-end framework note

The brief suggested Expo React Native; we shipped a Vite + React web app for instant,
zero-setup demoing (flagged in the README). To go native later, reuse `packages/shared` and
`packages/integrations` unchanged and re-implement the `apps/web` screens in Expo — the data
layer (`PsxApi` shape) and all business logic already live outside the UI.
