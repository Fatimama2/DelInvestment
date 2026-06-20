# Assumptions, simplifications & TODO-for-production

This is a **prototype**. The list below is what to revisit before anything real.

## ⚠️ Fees & taxes (verify before production)

All rates live in `packages/shared/src/config.ts` and are **illustrative**:

- Brokerage commission `0.15%`, sales tax on commission `13%`.
- Regulatory levies (SECP / PSX / CDC / NCCPL) are small placeholder percentages.
- Capital gains tax: filer `15%`, non-filer `20%` — applied to **realized gains on sale**.

**TODO:** verify every value against the **latest Finance Act**, SECP/PSX notifications and
the **NCCPL/CDC fee schedule**. Withholding taxes, CVT, advance tax and slab/holding-period
rules are **not** modelled in full. The filer/non-filer toggle exists to demonstrate that
rates are config-driven, not to be tax-accurate.

## Market data & prices

- Prices are **mock**: a seed base price + a per-symbol drift that is stable for the day +
  a tiny random jitter per fetch. Candle history is a **deterministic** seeded random walk
  ending at the base price. Fundamentals, share counts and 52-week ranges are plausible,
  **not** real.
- Indices (KSE-100, KMI-30) are derived from constituent drift, not real index math.

## Trading / settlement

- The matching engine is a stub: **MARKET** fills immediately; **LIMIT** fills if
  marketable else rests; **STOP** rests (no trigger simulation). No partial fills, no order
  book depth, no price/circuit limits.
- **T+1**: sale proceeds are credited to a **settling** balance and excluded from buying
  power; the prototype does not advance the clock to auto-settle them. Ledger `balanceAfter`
  tracks **settled** cash, so sells are shown with a `settlesOn` date rather than bumping
  available cash.
- No short selling; you can't sell more than you hold.

## Onboarding / identity / custody

- OTP, CNIC verification, liveness, shared-KYC pull, UIN assignment and CDC account opening
  are all **mocked** state transitions. The demo user starts at `READY_TO_FUND`; the
  Onboarding screen offers a replayable, purely-visual walkthrough of the journey.

## AI assistant

- RAG uses **feature-hashed term-frequency vectors** with cosine similarity (no model
  download, no vector DB). Good enough for this corpus; replace with real embeddings + a
  vector DB for production recall quality.
- Guardrails are a system prompt **plus** a code post-filter. The grounding guarantee is
  structural (numbers come from tool results) but the recommendation-style detector is
  heuristic — treat it as defense-in-depth, not a proof.
- A deliberate prompt-injection probe lives in `NEWS-INJ-01` (seed news) to demonstrate that
  retrieved content is treated as data, not instructions.

## What requires licensing / credentials before going live

- **SECP/PSX broker licensing** to route real orders; access to **KATS** (or a licensed
  market-data feed).
- **NCCPL** integration for UIN, KYC/CKO and clearing/settlement, plus official CGT
  computation.
- **CDC** integration for custody (Sub-Account / Investor Account).
- A **bank / PSO** integration for **Raast / IBFT** funding and withdrawals, with full AML/CFT.
- An **identity provider** for CNIC + liveness (and NADRA verification) for real KYC.
- A production datastore (the brief suggested **SQLite via Prisma**) replacing the in-memory
  `MockStore`, with proper auth, encryption and audit logging.
- Legal review of all disclosures, the "not financial advice" posture, and tax handling.

## Other simplifications

- Single demo user; no real auth (a `x-user-id` header identifies the account).
- Urdu translations are partial (key surfaces only); the i18n structure is complete.
- Watchlist reordering has an API but no drag-and-drop UI yet.
- "Export statements" and dividends history are represented in data/ledger but not as a
  dedicated export feature.
