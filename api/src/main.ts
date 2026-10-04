import { createApp } from './app.ts';
import { openRouterModel } from './assistant/model.ts';
import { systemClock } from './clock.ts';
import { createPool, DEV_DATABASE_URL } from './db.ts';
import { migrate } from './migrate.ts';

const passwordHash = process.env.APP_PASSWORD_HASH ?? '';
if (!passwordHash) {
  console.error('APP_PASSWORD_HASH is not set, so nobody could sign in. Make one with "npm run hash-password" and set it.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4732);
const production = process.env.NODE_ENV === 'production';
// One service in production (D33, D66): the API also serves the built web app.
const webDir = process.env.WEB_DIR ?? (production ? new URL('../../web/dist', import.meta.url).pathname : undefined);
const db = createPool(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
// A fresh deploy starts on an empty database; applied migrations are skipped.
const applied = await migrate(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);
const openRouter = { baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY ?? '' };
const models = [process.env.OPENROUTER_MODEL, ...(process.env.OPENROUTER_FALLBACK_MODELS ?? '').split(',')].map((m) => m?.trim()).filter((m): m is string => !!m);
createApp({
  db,
  clock: systemClock,
  config: { passwordHash, production, openRouter, webDir },
  model: openRouterModel({ ...openRouter, models }),
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
