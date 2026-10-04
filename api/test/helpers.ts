import type pg from 'pg';
import request from 'supertest';
import { afterAll } from 'vitest';
import { createApp } from '../src/app.ts';
import { hashPassword } from '../src/auth/password.ts';
import type { Clock } from '../src/clock.ts';
import { createPool } from '../src/db.ts';
import { migrate } from '../src/migrate.ts';

export const testDbUrl = () => process.env.TEST_DATABASE_URL!;
export const PASSWORD = 'correct horse battery staple';
const passwordHash = hashPassword(PASSWORD);

const pools: pg.Pool[] = [];
afterAll(async () => {
  await Promise.all(pools.splice(0).map((p) => p.end()));
});

export function testPool() {
  const pool = createPool(testDbUrl());
  pools.push(pool);
  return pool;
}

/** A clock tests can move: `clock.set('2026-10-01T12:15:00Z')`. */
export function mutableClock(iso: string) {
  let current = new Date(iso);
  const clock: Clock & { set(next: string): void } = { now: () => current, set: (next) => void (current = new Date(next)) };
  return clock;
}

/** A fresh app on a migrated, emptied test database. */
export async function testApp(opts: { now?: string; production?: boolean } = {}) {
  const db = testPool();
  await migrate(db);
  const { rows } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
  if (rows.length) await db.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  const clock = mutableClock(opts.now ?? '2026-10-01T12:00:00Z');
  const config = { passwordHash: await passwordHash, production: opts.production ?? false };
  return { app: createApp({ db, clock, config }), db, clock, config };
}

/** A supertest agent that is signed in (keeps the session cookie). */
export async function signIn(app: Parameters<typeof request.agent>[0]) {
  const agent = request.agent(app);
  const res = await agent.post('/api/session').send({ password: PASSWORD });
  if (res.status !== 204) throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

/** A valid new employee (POST /api/employees body). */
export const newEmployee = {
  code: 'E000123', firstName: 'Ana', lastName: 'Silva', gender: 'female', workEmail: 'ana.silva@acme.example',
  hireDate: '2024-02-29', country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 3, salary: 133000,
};
