# DEL Invest — PSX Trading Prototype + AI Assistant

A runnable **prototype** of a mobile-first stock & ETF trading app for the **Pakistan Stock
Exchange (PSX)** retail investor, plus an in-app **AI assistant**. The UX is benchmarked
against Robinhood / Webull (simple, clean, fast) but the data and flows are modelled on
Pakistan's market infrastructure: **CDC** custody, **NCCPL** clearing/KYC, **UIN**,
**T+1** settlement, **Raast** funding, and **Shariah-compliant** investing.

> ⚠️ **This is a prototype to validate UX, flows and the assistant — not a production
> trading system.** Every connection to an exchange, broker, depository, bank or clearing
> house is **MOCKED** behind a clean interface. No real orders are placed and no real money
> moves. Fees/taxes are illustrative and config-driven — verify before any production use.

Brand: **green / black / white**, with a **night mode** toggle, **3D** navigation, and the
**DEL** logo recreated as crisp scalable SVG.

---

## Quick start

**Prerequisites:** Node.js 20+ (tested on Node 24) and npm 10+.

```bash
# 1. install everything (npm workspaces)
npm install

# 2. (optional) enable the live AI assistant
cp .env.example .env        # then put your key in ANTHROPIC_API_KEY
#    Windows PowerShell:  Copy-Item .env.example .env

# 3. run the backend (:4000) and the web app (:5173) together
npm run dev
```

Then open **http://localhost:5173**.

- The app runs **with no key**: all market data, portfolio, trading, watchlists and
  flashcards work from seeded mock data, and the assistant uses a built-in **offline**
  mode (it can still pull your live mock portfolio, refuse advice, and launch flashcards).
- Add an `ANTHROPIC_API_KEY` to `.env` to switch the assistant to the **live** Claude
  experience (tool-calling + RAG). The header shows **Live API** / **Offline**.

> The web app talks to the backend by default and **falls back to running fully in the
> browser** (same mock logic) if the backend isn't reachable — so it's always explorable.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Backend + web together (recommended) |
| `npm run dev:backend` | Backend API only (http://localhost:4000) |
| `npm run dev:web` | Web app only (http://localhost:5173) |
| `npm run build` | Production build of the web app |
| `npm run typecheck` | Type-check web + backend |

---

## What's included (maps to the brief)

**10 MVP screens**

1. **Onboarding & KYC** — live status tracker (OTP → CNIC → UIN → CDC account → ready to fund), with a replayable walkthrough.
2. **Home / portfolio dashboard** — value, P&L, sector allocation donut, T+1 balances, indices, top movers.
3. **Discover** — search + screeners (**Shariah-compliant** toggle, KMI-30, sector, sort) over ~30 instruments.
4. **Stock/ETF detail** — line **and candlestick** charts, fundamentals, profile, news, buy/sell.
5. **Order ticket** — market/limit/stop, qty, validity, an **itemised fee + tax breakdown** and a confirmation sheet; T+1 settlement date.
6. **Funding** — deposit/withdraw via mock **Raast / IBFT**, ledger, available vs settling balance.
7. **Watchlists** — multiple lists, sparklines, add/remove.
8. **Education hub + flashcards** — 10 spaced-repetition decks with a 3D flip.
9. **AI assistant** — persistent tab, screen-context aware (see below).
10. **Account & settings** — **night mode**, language (en/ur), filer status, Shariah preference, account tier, PIN/biometric & 2FA stubs, UIN.

**AI assistant**

- Splits **knowledge** (RAG: app help/FAQ, glossary, education, news, announcements,
  company profiles) from **live data** (tool calls: portfolio, balances, quotes,
  watchlist, orders, account context).
- **News agent**, **portfolio explainer**, **education + flashcard launching**, **app help
  with deep links**, and **timestamped, grounded** portfolio/watchlist Q&A.
- **Guardrails enforced in code:** refuses personalized buy/sell/hold advice, injects a
  "not financial advice" disclosure, never invents prices/balances (they come from tools),
  cannot place orders or move money (only deep-links you to confirm), treats retrieved
  documents as **untrusted data** (prompt-injection safe — see the `NEWS-INJ-01` probe),
  and logs every tool call.

**Architecture & safety**

- Every external system is an **interface + MOCK adapter** in `packages/integrations`
  (MarketData, BrokerOms, CDC, NCCPL, Payment, Identity) — swap a real provider without
  touching app logic.
- **No secrets in code.** The Anthropic key lives only in `.env` (git-ignored).
- **Fees/taxes are config-driven** in `packages/shared/src/config.ts`, flagged
  "verify against latest Finance Act / NCCPL schedule before production." Filer vs
  non-filer changes the capital-gains tax used in estimates.
- **T+1 settlement** modelled: sale proceeds are "settling" until T+1; only settled cash is buying power.
- **Bilingual-ready** (English + Urdu) i18n scaffold with RTL handling.

---

## Project structure

```
psx/
├─ apps/
│  ├─ backend/        # Node + TypeScript (Express) REST API + AI assistant
│  └─ web/            # Vite + React + TypeScript phone-styled app
├─ packages/
│  ├─ shared/         # types, fee/tax config, i18n, theme, seed data, portfolio math
│  └─ integrations/   # provider interfaces + MOCK adapters + DataService
├─ docs/              # architecture.md, assumptions.md
├─ .env.example
└─ package.json       # npm workspaces
```

---

## Note on the stack (a flagged deviation)

The brief suggested **React Native + Expo**. With the user's go-ahead we built the
front-end as a **Vite + React + TypeScript phone-styled web app** instead, because it opens
instantly in any browser, makes the green/black/white look, 3D navigation and night mode
fast to deliver, and needs near-zero setup to demo. **Everything the brief cares about
architecturally is unchanged:** the Node/TS backend, the mocked integration layer behind
interfaces, shared config-driven fees, the AI assistant with RAG + tools + guardrails, and
the seed data. See [`docs/architecture.md`](docs/architecture.md) for the swap path to a
native app.

---

## Learn more

- [`docs/architecture.md`](docs/architecture.md) — how it fits together and the **mock → real** swap path.
- [`docs/assumptions.md`](docs/assumptions.md) — assumptions, simplifications, **TODO-for-production**, and **what requires licensing/credentials** before going live.
