import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Load the repo-root .env first (it wins), then any local .env. dotenv does
// not override already-set variables, so root values take precedence.
dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config();

export const ENV = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  anthropicApiKey: (process.env.ANTHROPIC_API_KEY ?? '').trim(),
  anthropicModel: (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6').trim(),
};

export const hasAnthropicKey = ENV.anthropicApiKey.length > 0;
