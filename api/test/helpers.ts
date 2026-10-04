import pg from 'pg';
import { afterAll } from 'vitest';
import { createApp } from '../src/app.ts';
import { fixedClock } from '../src/clock.ts';

export const testDbUrl = () => process.env.TEST_DATABASE_URL!;

const pools: pg.Pool[] = [];
afterAll(async () => {
  await Promise.all(pools.splice(0).map((p) => p.end()));
});

export function testPool() {
  const pool = new pg.Pool({ connectionString: testDbUrl() });
  pools.push(pool);
  return pool;
}

export async function testApp(opts: { now?: string } = {}) {
  const db = testPool();
  const clock = fixedClock(opts.now ?? '2026-10-01T12:00:00Z');
  return { app: createApp({ db, clock }), db, clock };
}
