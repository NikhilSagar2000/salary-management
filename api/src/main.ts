import { createApp } from './app.ts';
import { systemClock } from './clock.ts';
import { createPool } from './db.ts';

const port = Number(process.env.PORT ?? 4732);
const db = createPool(process.env.DATABASE_URL ?? 'postgres://acme:acme@localhost:4734/acme');
createApp({ db, clock: systemClock }).listen(port, () => console.log(`API listening on http://localhost:${port}`));
