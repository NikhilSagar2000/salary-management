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

test('exactly 10,000 with the country split', async () => {
  expect(seed.employees).toHaveLength(10_000);
  const { rows } = await db.query(
    `SELECT c.country, count(*)::int AS n FROM job_changes c
     WHERE c.id IN (SELECT min(id) FROM job_changes GROUP BY employee_id) GROUP BY c.country ORDER BY c.country`,
  );
  expect(Object.fromEntries(rows.map((r) => [r.country, r.n]))).toEqual({ BR: 800, DE: 1200, GB: 1200, IN: 3000, JP: 800, US: 3000 });
  expect((await db.query('SELECT count(*)::int AS n FROM employees')).rows[0].n).toBe(10_000);
});

const CHECKSUM = `SELECT md5(
  (SELECT string_agg(concat_ws('|', id, code, first_name, last_name, gender, work_email, hire_date, leave_date, leave_reason), ',' ORDER BY id) FROM employees) ||
  (SELECT string_agg(concat_ws('|', id, employee_id, effective_date, country, department, role, level, manager_set, manager_id, salary, currency, note), ',' ORDER BY id) FROM job_changes) ||
  coalesce((SELECT string_agg(concat_ws('|', id, employee_id, kind, leave_date, reason), ',' ORDER BY id) FROM leave_events), '')
) AS sum`;

test('two runs give the same checksum', async () => {
  const first = (await db.query(CHECKSUM)).rows[0].sum;
  const again = (await testApp({ now: `${SEED_ANCHOR}T12:00:00Z` })).db; // empties the tables
  await writeSeed(again, generateSeed());
  expect((await again.query(CHECKSUM)).rows[0].sum).toBe(first);
});
