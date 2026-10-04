// npm run measure:list — LIST-11: list requests (search + filters + sort) on the seeded database,
// through the real HTTP API. Exits 1 if the 95th percentile is above 300 ms.
import { createApp } from './app.ts';
import { hashPassword } from './auth/password.ts';
import { systemClock } from './clock.ts';
import { createPool, DEV_DATABASE_URL } from './db.ts';

const QUERIES = [
  '', '?q=sharma', '?q=mull', '?country=US&department=Engineering', '?country=IN&sort=salary&dir=desc',
  '?level=3,4&gender=female&sort=hireDate', '?status=left', '?page=50&pageSize=100',
  '?country=DE&salaryMin=60000&salaryMax=90000', '?role=Account%20Executive&sort=name&dir=desc',
];
const ROUNDS = 20;
const LIMIT_MS = 300;

const db = createPool(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
const people = (await db.query('SELECT count(*) AS n FROM employees')).rows[0].n;
if (Number(people) !== 10_000) {
  console.error(`Expected the 10,000-person seed but found ${people} employees. Run "npm run seed -- --reset" first.`);
  process.exit(1);
}
const password = 'measure';
const model = async function* () { yield { type: 'done' as const }; };
const config = { passwordHash: await hashPassword(password), production: false, openRouter: { baseUrl: 'http://127.0.0.1:9', apiKey: '' } };
const server = createApp({ db, clock: systemClock, config, model }).listen(0);
const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const signIn = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
const cookie = signIn.headers.get('set-cookie')!.split(';')[0]!;

const times: number[] = [];
for (let round = -1; round < ROUNDS; round++) {
  for (const q of QUERIES) {
    const t0 = performance.now();
    const res = await fetch(`${base}/api/employees${q}`, { headers: { cookie } });
    await res.json();
    if (!res.ok) throw new Error(`${q} answered ${res.status}`);
    if (round >= 0) times.push(performance.now() - t0); // round -1 warms caches
  }
}
server.close();
await db.end();
times.sort((a, b) => a - b);
const at = (p: number) => times[Math.min(times.length - 1, Math.ceil(p * times.length) - 1)]!;
console.log(`${times.length} list requests: p50 ${at(0.5).toFixed(0)} ms, p95 ${at(0.95).toFixed(0)} ms, max ${times.at(-1)!.toFixed(0)} ms (limit ${LIMIT_MS} ms at p95)`);
process.exit(at(0.95) > LIMIT_MS ? 1 : 0);
