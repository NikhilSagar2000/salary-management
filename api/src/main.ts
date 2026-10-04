import { createApp } from './app.ts';
import { openRouterModel } from './assistant/model.ts';
import { systemClock } from './clock.ts';
import { createPool, DEV_DATABASE_URL } from './db.ts';

const port = Number(process.env.PORT ?? 4732);
const db = createPool(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
const openRouter = { baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY ?? '' };
const models = [process.env.OPENROUTER_MODEL, ...(process.env.OPENROUTER_FALLBACK_MODELS ?? '').split(',')].map((m) => m?.trim()).filter((m): m is string => !!m);
createApp({
  db,
  clock: systemClock,
  config: { passwordHash: process.env.APP_PASSWORD_HASH ?? '', production: process.env.NODE_ENV === 'production', openRouter },
  model: openRouterModel({ ...openRouter, models }),
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
