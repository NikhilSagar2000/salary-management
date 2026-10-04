// The end-to-end server: a fresh seeded database (acme_e2e), the fake OpenRouter, and the API serving the built web app on 4733.
import pg from 'pg';
import { createApp } from '../api/src/app.ts';
import { openRouterModel } from '../api/src/assistant/model.ts';
import { hashPassword } from '../api/src/auth/password.ts';
import { systemClock } from '../api/src/clock.ts';
import { createPool } from '../api/src/db.ts';
import { migrate } from '../api/src/migrate.ts';
import { generateSeed } from '../api/src/seed/generate.ts';
import { writeSeed } from '../api/src/seed/write.ts';
import { ADMIN_DATABASE_URL, E2E_DATABASE_URL, E2E_MODEL_KEY, E2E_PASSWORD, E2E_PORT, WEB_DIST } from './env.ts';
import { startFakeOpenRouter } from './fake-openrouter.ts';

const admin = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
await admin.connect();
const name = new URL(E2E_DATABASE_URL).pathname.slice(1);
if (!/^[a-z_]+_e2e$/.test(name)) throw new Error(`Refusing to reset "${name}": the end-to-end database name must end in _e2e.`);
await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${name}`);
await admin.end();

const db = createPool(E2E_DATABASE_URL);
await migrate(db);
await writeSeed(db, generateSeed());

const fake = await startFakeOpenRouter(E2E_MODEL_KEY);
// AST-18: the end-to-end run must never reach the real model.
if (new URL(fake.url).hostname.endsWith('openrouter.ai')) throw new Error('The end-to-end server must not use the real OpenRouter.');
const openRouter = { baseUrl: fake.url, apiKey: E2E_MODEL_KEY };

createApp({
  db,
  clock: systemClock,
  config: { passwordHash: await hashPassword(E2E_PASSWORD), production: false, openRouter, webDir: WEB_DIST },
  model: openRouterModel({ ...openRouter, models: ['fake/model:free'] }),
}).listen(E2E_PORT, () => console.log(`End-to-end server on http://localhost:${E2E_PORT} (fake OpenRouter at ${fake.url})`));
