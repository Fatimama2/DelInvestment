import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ENV, hasAnthropicKey } from './env';
import { APP_CONFIG } from './psx';
import { buildRouter } from './routes';

const app = express();

// Prototype CORS: reflect the requesting origin (fine for local dev).
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    `${APP_CONFIG.name} — PSX prototype API. ${APP_CONFIG.prototypeBanner}\nTry GET /api/health`,
  );
});

app.use('/api', buildRouter());

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[backend] error:', err);
  res.status(500).json({ error: (err as Error)?.message ?? 'server error' });
};
app.use(onError);

app.listen(ENV.port, () => {
  console.log('--------------------------------------------------------------');
  console.log(`[backend] ${APP_CONFIG.name} API → http://localhost:${ENV.port}`);
  console.log(`[backend] assistant mode: ${hasAnthropicKey ? `LIVE (${ENV.anthropicModel})` : 'OFFLINE (no ANTHROPIC_API_KEY)'}`);
  console.log('[backend] ALL integrations are MOCKED — no real market, money or orders.');
  console.log('--------------------------------------------------------------');
});
