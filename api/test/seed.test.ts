import type pg from 'pg';
import { beforeAll, expect, test } from 'vitest';
import { generateSeed, SEED_ANCHOR, type Seed } from '../src/seed/generate.ts';
import { writeSeed } from '../src/seed/write.ts';
import { testApp } from './helpers.ts';

let seed: Seed;
let db: pg.Pool;

beforeAll(async () => {
  seed = generateSeed();
  db = (await testApp({ now: `${SEED_ANCHOR}T12:00:00Z` })).db;
  await writeSeed(db, seed);
}, 180_000);

test.fails('exactly 10,000 with the country split', async () => {
  expect(seed.employees).toHaveLength(10_000);
  const { rows } = await db.query(
    `SELECT c.country, count(*)::int AS n FROM job_changes c
     WHERE c.id IN (SELECT min(id) FROM job_changes GROUP BY employee_id) GROUP BY c.country ORDER BY c.country`,
  );
  expect(Object.fromEntries(rows.map((r) => [r.country, r.n]))).toEqual({ BR: 800, DE: 1200, GB: 1200, IN: 3000, JP: 800, US: 3000 });
  expect((await db.query('SELECT count(*)::int AS n FROM employees')).rows[0].n).toBe(10_000);
});
