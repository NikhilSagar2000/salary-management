import { CURRENCY } from '@acme/shared';
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

test('about 30 listed outliers and nobody else beyond the limits', async () => {
  const { rows } = await db.query(
    `WITH s AS (
       SELECT e.code, s.country, s.role, s.level, s.salary
       FROM employee_state($1) s JOIN employees e ON e.id = s.employee_id
       WHERE e.hire_date <= $1 AND (e.leave_date IS NULL OR e.leave_date > $1)
     ), peers AS (
       SELECT country, role, level, percentile_cont(0.5) WITHIN GROUP (ORDER BY salary) AS median, count(*)::int AS n
       FROM s GROUP BY 1, 2, 3
     )
     SELECT s.code, s.salary / p.median AS ratio, p.n FROM s JOIN peers p USING (country, role, level)`,
    [SEED_ANCHOR],
  );
  const outliers = new Set(seed.outliers);
  expect(outliers.size).toBeGreaterThanOrEqual(25);
  expect(outliers.size).toBeLessThanOrEqual(35);
  let high = 0;
  for (const r of rows) {
    if (outliers.has(r.code)) {
      expect(r.n, r.code).toBeGreaterThanOrEqual(20);
      expect(r.ratio > 1.8 || r.ratio < 0.55, `${r.code} ratio ${r.ratio}`).toBe(true);
      if (r.ratio > 1.8) high++;
    } else {
      expect(r.ratio, r.code).toBeGreaterThanOrEqual(0.55);
      expect(r.ratio, r.code).toBeLessThanOrEqual(1.8);
    }
  }
  expect(rows.filter((r) => outliers.has(r.code))).toHaveLength(outliers.size); // every outlier is employed at the anchor
  expect(high).toBeGreaterThan(5);
  expect(outliers.size - high).toBeGreaterThan(5);
});

test('every person starts with a hire change; raises, promotions, relocations with new-currency salaries and leavers exist', () => {
  const byCode = new Map<string, typeof seed.changes>();
  for (const c of seed.changes) byCode.set(c.code, [...(byCode.get(c.code) ?? []), c]);
  let raises = 0, promotions = 0, relocations = 0;
  for (const e of seed.employees) {
    const changes = byCode.get(e.code)!;
    const [hire, ...rest] = changes;
    expect(hire!.effectiveDate, e.code).toBe(e.hireDate);
    expect([hire!.country, hire!.department, hire!.role, hire!.level, hire!.salary, hire!.currency].every((v) => v !== null), e.code).toBe(true);
    expect(changes.every((c, i) => i === 0 || c.effectiveDate >= changes[i - 1]!.effectiveDate), e.code).toBe(true);
    if (e.leaveDate) expect(changes.every((c) => c.effectiveDate <= e.leaveDate!), e.code).toBe(true);
    for (const c of rest) {
      if (c.country) {
        relocations++;
        expect(c.salary, e.code).not.toBeNull();
        expect(c.currency, e.code).toBe(CURRENCY[c.country]);
      } else if (c.level) promotions++;
      else if (c.salary) raises++;
    }
  }
  expect(raises).toBeGreaterThan(10_000);
  expect(promotions).toBeGreaterThan(1_000);
  expect(relocations).toBeGreaterThanOrEqual(50);
  expect(relocations).toBeLessThanOrEqual(200);
  const leavers = seed.employees.filter((e) => e.leaveDate);
  expect(leavers.length).toBeGreaterThan(800);
  expect(leavers.length).toBeLessThan(1600);
  const left = new Map(seed.leaveEvents.filter((ev) => ev.kind === 'left').map((ev) => [ev.code, ev.leaveDate]));
  for (const e of leavers) expect(left.get(e.code), e.code).toBe(e.leaveDate);
});

test('managers employed, more senior, no loops', async () => {
  // On a sample of dates, every manager in force is employed that day, in the same country and department, and more senior.
  for (const date of ['2014-06-30', '2018-03-15', '2021-11-01', '2024-04-02', SEED_ANCHOR]) {
    const { rows } = await db.query(
      `WITH s AS (SELECT * FROM employee_state($1))
       SELECT e.code, s.manager_id, ms.level AS manager_level, s.level, ms.country = s.country AS same_country,
              ms.department = s.department AS same_department,
              m.hire_date <= $1 AND (m.leave_date IS NULL OR m.leave_date > $1) AS manager_employed
       FROM s JOIN employees e ON e.id = s.employee_id
       JOIN employees m ON m.id = s.manager_id JOIN s ms ON ms.employee_id = s.manager_id
       WHERE e.hire_date <= $1 AND (e.leave_date IS NULL OR e.leave_date > $1)`,
      [date],
    );
    for (const r of rows) {
      expect(r.manager_employed, `${date} ${r.code}`).toBe(true);
      expect(r.same_country && r.same_department, `${date} ${r.code}`).toBe(true);
      expect(r.manager_level, `${date} ${r.code}`).toBeGreaterThan(r.level);
    }
    if (date === SEED_ANCHOR) expect(rows.length).toBeGreaterThan(6000); // most people have a manager
  }
  // Strictly higher levels make loops impossible; check the anchor chain anyway.
  const loops = await db.query(
    `WITH RECURSIVE s AS MATERIALIZED (SELECT employee_id, manager_id FROM employee_state($1)),
     chain (start, id, depth) AS (
       SELECT employee_id, manager_id, 1 FROM s WHERE manager_id IS NOT NULL
       UNION ALL SELECT chain.start, s.manager_id, depth + 1 FROM chain JOIN s ON s.employee_id = chain.id WHERE s.manager_id IS NOT NULL AND depth < 20
     )
     SELECT count(*)::int AS n FROM chain WHERE id = start`,
    [SEED_ANCHOR],
  );
  expect(loops.rows[0].n).toBe(0);
});
