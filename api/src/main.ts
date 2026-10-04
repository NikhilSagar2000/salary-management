import { createApp } from './app.ts';
import { systemClock } from './clock.ts';
import { createPool, DEV_DATABASE_URL } from './db.ts';

const port = Number(process.env.PORT ?? 4732);
const db = createPool(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
createApp({
  db,
  clock: systemClock,
  config: { passwordHash: process.env.APP_PASSWORD_HASH ?? '', production: process.env.NODE_ENV === 'production' },
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
