import type pg from 'pg';
import { beforeAll, expect, test } from 'vitest';
import { generateSeed, SEED_ANCHOR, type Seed } from '../src/seed/generate.ts';
import { band } from '../src/seed/bands.ts';
import { NAMES } from '../src/seed/names.ts';
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

const hireCountry = () => new Map(seed.changes.filter((c) => c.country !== null).reverse().map((c) => [c.code, c.country!]));

test('every full name differs and fits country and gender', () => {
  const full = seed.employees.map((e) => `${e.firstName} ${e.lastName}`);
  expect(new Set(full).size).toBe(10_000);
  const country = hireCountry();
  for (const e of seed.employees) {
    const lists = NAMES[country.get(e.code)!];
    const given = e.gender === 'female' ? lists.female : e.gender === 'male' ? lists.male : lists.neutral;
    expect(given, `${e.code} ${e.firstName}`).toContain(e.firstName);
    expect(lists.last, `${e.code} ${e.lastName}`).toContain(e.lastName);
  }
  const genders = seed.employees.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.gender]: (acc[e.gender] ?? 0) + 1 }), {});
  expect(genders.non_binary).toBeGreaterThan(0);
});

test('codes E000001–E010000, emails unique', () => {
  const codes = seed.employees.map((e) => e.code).sort();
  expect(codes[0]).toBe('E000001');
  expect(codes.at(-1)).toBe('E010000');
  expect(new Set(codes).size).toBe(10_000);
  const emails = seed.employees.map((e) => e.workEmail.toLowerCase());
  expect(new Set(emails).size).toBe(10_000);
  for (const email of emails) expect(email).toMatch(/^[a-z]+(\.[a-z]+)*@acme\.example$/);
});

test('no date after 2026-09-30, hires from 2012', () => {
  const dates = [
    ...seed.employees.flatMap((e) => [e.hireDate, e.leaveDate]),
    ...seed.changes.map((c) => c.effectiveDate),
    ...seed.leaveEvents.map((e) => e.leaveDate),
  ].filter((d): d is string => d !== null);
  expect(dates.every((d) => d <= SEED_ANCHOR)).toBe(true);
  const hires = seed.employees.map((e) => e.hireDate).sort();
  expect(hires[0]! >= '2012-01-01').toBe(true);
  expect(hires[0]! < '2012-12-31').toBe(true); // the company has people from its first year
});

test('group medians within ±15% of the researched bands', async () => {
  // band() against values worked out by hand from docs/research/pay-bands.md
  expect(band('US', 'Software Engineer', 'Engineering', 3)).toBe(131000);
  expect(Math.round(band('US', 'Software Engineer', 'Engineering', 4))).toBe(168990); // × 1.29
  expect(Math.round(band('IN', 'Engineering Manager', 'Engineering', 5))).toBe(5290000); // EM figure is an L5 value
  expect(Math.round(band('IN', 'Engineering Manager', 'Engineering', 6))).toBe(6524948); // × 3.54 / 2.87
  expect(Math.round(band('JP', 'Accountant', 'Finance', 2))).toBe(3822300); // × 0.93
  expect(Math.round(band('GB', 'Recruiter', 'HR', 7))).toBe(101640); // other departments × 2.42

  const { rows } = await db.query(
    `SELECT s.country, s.role, s.department, s.level, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.salary) AS median, count(*)::int AS n
     FROM employee_state($1) s JOIN employees e ON e.id = s.employee_id
     WHERE e.hire_date <= $1 AND (e.leave_date IS NULL OR e.leave_date > $1)
     GROUP BY 1, 2, 3, 4 HAVING count(*) >= 20`,
    [SEED_ANCHOR],
  );
  expect(rows.length).toBeGreaterThan(40);
  for (const g of rows) {
    const ratio = g.median / band(g.country, g.role, g.department, g.level);
    expect(ratio, `${g.country} ${g.role} L${g.level} (n=${g.n})`).toBeGreaterThan(0.85);
    expect(ratio, `${g.country} ${g.role} L${g.level} (n=${g.n})`).toBeLessThan(1.15);
  }
});

test("women's median below men's by the country's gap", async () => {
  const { rows } = await db.query(
    `SELECT s.country, s.role, s.department, s.level, s.salary, e.gender
     FROM employee_state($1) s JOIN employees e ON e.id = s.employee_id
     WHERE e.hire_date <= $1 AND (e.leave_date IS NULL OR e.leave_date > $1) AND e.code <> ALL($2)`,
    [SEED_ANCHOR, seed.outliers],
  );
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length / 2;
    return s.length % 2 ? s[Math.floor(m)]! : (s[m - 1]! + s[m]!) / 2;
  };
  const gaps: Record<string, number> = { US: 0.01, IN: 0.08, GB: 0.04, DE: 0.06, BR: 0.06, JP: 0.12 }; // D61
  for (const country of Object.keys(gaps)) {
    const people = rows.filter((r) => r.country === country);
    const relative = (g: string) => median(people.filter((r) => r.gender === g).map((r) => r.salary / band(r.country, r.role, r.department, r.level)));
    const ratio = relative('female') / relative('male');
    expect(ratio, country).toBeLessThan(1);
    expect(Math.abs(ratio - (1 - gaps[country]!)), `${country}: ratio ${ratio.toFixed(3)}`).toBeLessThan(0.03);
  }
});
