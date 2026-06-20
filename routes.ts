import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { ENV, hasAnthropicKey } from './env';
import { ragStore } from './rag';
import { dataService } from './services';
import { runAssistant } from './assistant';
import { APP_CONFIG, DECKS, DECKS_BY_ID, FEE_CONFIG, SETTLEMENT_CONFIG, type KycStage, type OrderRequest, type Timeframe } from './psx';

const uid = (req: Request): string => (req.header('x-user-id') || 'u_demo').toString();

// Wrap async handlers so thrown/rejected errors become clean JSON (instead of
// crashing) — including friendly messages for zod validation failures.
const h =
  (fn: (req: Request, res: Parameters<RequestHandler>[1]) => unknown): RequestHandler =>
  (req, res) =>
    Promise.resolve(fn(req, res)).catch((e: unknown) => {
      const err = e as { issues?: { message: string }[]; message?: string };
      const message = err?.issues?.[0]?.message ?? err?.message ?? 'Request failed';
      res.status(400).json({ error: message });
    });

const orderSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP']),
  qty: z.number().positive('Quantity must be greater than 0'),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  validity: z.enum(['DAY', 'GTC']).default('DAY'),
});

const KYC_ORDER: KycStage[] = ['NOT_STARTED', 'OTP_VERIFIED', 'CNIC_SUBMITTED', 'UIN_ASSIGNED', 'CDC_ACCOUNT_OPEN', 'READY_TO_FUND'];
const KYC_LABELS: Record<string, string> = {
  OTP_VERIFIED: 'Verify phone (OTP)',
  CNIC_SUBMITTED: 'Submit CNIC & identity',
  UIN_ASSIGNED: 'UIN assigned (NCCPL)',
  CDC_ACCOUNT_OPEN: 'Open CDC sub-account',
  READY_TO_FUND: 'Ready to fund',
};

function onboardingView(userId: string) {
  const user = dataService.getUser(userId);
  const idx = KYC_ORDER.indexOf(user.kycStage);
  const steps = KYC_ORDER.slice(1).map((k) => {
    const ki = KYC_ORDER.indexOf(k);
    return { key: k, label: KYC_LABELS[k], status: idx >= ki ? 'done' : idx + 1 === ki ? 'current' : 'pending' };
  });
  return { user, stage: user.kycStage, steps };
}

export function buildRouter(): Router {
  const r = Router();

  // ---------- Health / meta ----------
  r.get('/health', (_req, res) => {
    res.json({
      ok: true,
      mock: true,
      app: APP_CONFIG.name,
      assistant: hasAnthropicKey ? 'live' : 'offline',
      model: hasAnthropicKey ? ENV.anthropicModel : null,
      ragDocs: ragStore.size,
      settlement: SETTLEMENT_CONFIG.cycle,
    });
  });
  r.get('/config/fees', (_req, res) => res.json(FEE_CONFIG));

  // ---------- Discovery / market ----------
  r.get('/instruments', h(async (_req, res) => res.json(await dataService.listInstruments())));
  r.get('/instruments/:symbol', h(async (req, res) => {
    const inst = await dataService.getInstrument(String(req.params.symbol));
    if (!inst) return res.status(404).json({ error: 'Unknown symbol' });
    const quote = await dataService.getQuote(String(req.params.symbol));
    res.json({ instrument: inst, quote });
  }));
  r.get('/quote/:symbol', h(async (req, res) => res.json(await dataService.getQuote(String(req.params.symbol)))));
  r.post('/quotes', h(async (req, res) => res.json(await dataService.getQuotes((req.body?.symbols ?? []) as string[]))));
  r.get('/candles/:symbol', h(async (req, res) => res.json(await dataService.getCandles(String(req.params.symbol), (req.query.tf as Timeframe) || '3M'))));
  r.get('/indices', h(async (_req, res) => res.json(await dataService.getIndices())));
  r.get('/search', h(async (req, res) => res.json(await dataService.search(String(req.query.q ?? '')))));
  r.get('/screen', h(async (req, res) =>
    res.json(
      await dataService.screen({
        query: req.query.q ? String(req.query.q) : undefined,
        shariah: req.query.shariah === 'true',
        kmi30: req.query.kmi30 === 'true',
        sector: req.query.sector ? String(req.query.sector) : undefined,
        type: req.query.type === 'ETF' ? 'ETF' : req.query.type === 'EQUITY' ? 'EQUITY' : undefined,
        sort: req.query.sort as never,
      }),
    ),
  ));
  r.get('/movers', h(async (_req, res) => res.json(await dataService.movers())));
  r.get('/news', h(async (req, res) => {
    const symbols = req.query.symbols ? String(req.query.symbols).split(',').filter(Boolean) : undefined;
    res.json(dataService.getNews(symbols));
  }));

  // ---------- Portfolio / cash ----------
  r.get('/portfolio', h(async (req, res) => res.json(await dataService.getPortfolio(uid(req)))));
  r.get('/balances', h(async (req, res) => res.json(await dataService.getBalances(uid(req)))));
  r.get('/ledger', h(async (req, res) => res.json(await dataService.getLedger(uid(req)))));
  r.post('/funding/deposit', h(async (req, res) => {
    const { amount, method } = z.object({ amount: z.number().positive('Enter a positive amount'), method: z.enum(['RAAST', 'IBFT']).default('RAAST') }).parse(req.body);
    res.json(await dataService.deposit(uid(req), amount, method));
  }));
  r.post('/funding/withdraw', h(async (req, res) => {
    const { amount } = z.object({ amount: z.number().positive('Enter a positive amount') }).parse(req.body);
    res.json(await dataService.withdraw(uid(req), amount));
  }));

  // ---------- Trading ----------
  r.post('/orders/estimate', h(async (req, res) => res.json(await dataService.estimateOrder(uid(req), orderSchema.parse(req.body) as OrderRequest))));
  r.post('/orders', h(async (req, res) => res.json(await dataService.placeOrder(uid(req), orderSchema.parse(req.body) as OrderRequest))));
  r.get('/orders', h(async (req, res) => res.json(await dataService.getOrders(uid(req)))));
  r.post('/orders/:id/cancel', h(async (req, res) => res.json(await dataService.cancelOrder(uid(req), String(req.params.id)))));

  // ---------- Watchlists ----------
  r.get('/watchlists', h(async (req, res) => res.json(dataService.getWatchlists(uid(req)))));
  r.post('/watchlists/:id/add', h(async (req, res) => res.json(dataService.addToWatchlist(uid(req), String(req.params.id), String(req.body?.symbol)))));
  r.post('/watchlists/:id/remove', h(async (req, res) => res.json(dataService.removeFromWatchlist(uid(req), String(req.params.id), String(req.body?.symbol)))));
  r.post('/watchlists/:id/reorder', h(async (req, res) => res.json(dataService.reorderWatchlist(uid(req), String(req.params.id), (req.body?.symbols ?? []) as string[]))));

  // ---------- Onboarding / account ----------
  r.get('/me', h(async (req, res) => res.json(dataService.getUser(uid(req)))));
  r.patch('/me', h(async (req, res) => {
    const patch = z.object({
      language: z.enum(['en', 'ur']).optional(),
      filerStatus: z.enum(['FILER', 'NON_FILER']).optional(),
      shariahOnly: z.boolean().optional(),
      accountType: z.enum(['STANDARD', 'SAHULAT']).optional(),
    }).parse(req.body);
    res.json(dataService.updateUser(uid(req), patch));
  }));
  r.get('/onboarding', h(async (req, res) => res.json(onboardingView(uid(req)))));
  r.post('/onboarding/otp', h(async (req, res) => res.json(dataService.verifyOtp(uid(req)))));
  r.post('/onboarding/cnic', h(async (req, res) => res.json(await dataService.submitCnic(uid(req), String(req.body?.cnic ?? '')))));
  r.post('/onboarding/advance', h(async (req, res) => res.json(await dataService.advanceKyc(uid(req)))));
  r.post('/onboarding/details', h(async (req, res) => {
    const d = z.object({
      name: z.string().optional(),
      cnic: z.string().optional(),
      iban: z.string().optional(),
      bankName: z.string().optional(),
    }).parse(req.body);
    res.json(dataService.saveKycDetails(uid(req), d));
  }));
  r.post('/onboarding/risk', h(async (req, res) => {
    const { profile } = z.object({ profile: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']) }).parse(req.body);
    res.json(dataService.setRiskProfile(uid(req), profile));
  }));

  // ---------- Education ----------
  r.get('/decks', (_req, res) => res.json(DECKS));
  r.get('/decks/:id', (req, res) => {
    const deck = DECKS_BY_ID[String(req.params.id)];
    if (!deck) return res.status(404).json({ error: 'Unknown deck' });
    res.json(deck);
  });

  // ---------- Assistant ----------
  r.post('/assistant/chat', h(async (req, res) => {
    const { message, screen, symbol } = z.object({
      message: z.string().min(1, 'Message is required'),
      screen: z.string().optional(),
      symbol: z.string().optional(),
    }).parse(req.body);
    res.json(await runAssistant({ message, userId: uid(req), screen, symbol }));
  }));

  return r;
}
