import { createApp } from './app.ts';
import { systemClock } from './clock.ts';
import { createPool } from './db.ts';

const port = Number(process.env.PORT ?? 4732);
const db = createPool(process.env.DATABASE_URL ?? 'postgres://acme:acme@localhost:4734/acme');
createApp({
  db,
  clock: systemClock,
  config: { passwordHash: process.env.APP_PASSWORD_HASH ?? '', production: process.env.NODE_ENV === 'production' },
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
