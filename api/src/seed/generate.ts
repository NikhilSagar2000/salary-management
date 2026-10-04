// The seed (SEED-1…10): exactly 10,000 employees, identical every run, with realistic pay (D59–D62).
import { CURRENCY, ROLES, type Country, type Currency, type Department, type Gender, type Role } from '@acme/shared';
import { band, MARKET_SPREAD, SAME_JOB_GAP } from './bands.ts';
import { NAMES } from './names.ts';
import { between, mulberry32, normal, pick, shuffle, weighted, type Rng } from './random.ts';

export const SEED_ANCHOR = '2026-09-30';
const SEED_NUMBER = 20261004;

export type SeedEmployee = {
  code: string; firstName: string; lastName: string; gender: Gender; workEmail: string;
  hireDate: string; leaveDate: string | null; leaveReason: string | null;
};
export type SeedChange = {
  code: string; effectiveDate: string; country: Country | null; department: Department | null; role: Role | null;
  level: number | null; managerSet: boolean; managerCode: string | null; salary: number | null; currency: Currency | null; note: string | null;
};
export type SeedLeaveEvent = { code: string; kind: 'left' | 'undone'; leaveDate: string; reason: string | null };
export type Seed = { employees: SeedEmployee[]; changes: SeedChange[]; leaveEvents: SeedLeaveEvent[]; outliers: string[] };

const COUNTS: Record<Country, number> = { US: 3000, IN: 3000, GB: 1200, DE: 1200, BR: 800, JP: 800 };
const DEPARTMENT_WEIGHTS: [Department, number][] = [
  ['Engineering', 40], ['Sales', 15], ['Customer Support', 12], ['Marketing', 7], ['Operations', 7],
  ['Product', 6], ['Finance', 5], ['Design', 4], ['HR', 4],
];
const ROLE_WEIGHTS: Record<Department, [Role, number][]> = {
  Engineering: [['Software Engineer', 60], ['Data Engineer', 15], ['QA Engineer', 15], ['Engineering Manager', 10]],
  Product: [['Product Manager', 1]],
  Design: [['Product Designer', 1]],
  Sales: [['Sales Development Representative', 30], ['Account Executive', 55], ['Sales Manager', 15]],
  Marketing: [['Marketing Specialist', 70], ['Marketing Manager', 30]],
  'Customer Support': [['Support Specialist', 80], ['Support Manager', 20]],
  Finance: [['Accountant', 50], ['Financial Analyst', 50]],
  HR: [['HR Generalist', 60], ['Recruiter', 40]],
  Operations: [['Operations Analyst', 60], ['IT Support Specialist', 40]],
};
const LEVEL_WEIGHTS = [12, 22, 26, 20, 12, 6, 2];
const GENDER_WEIGHTS: [Gender, number][] = [['female', 42], ['male', 56], ['non_binary', 2]];

// ---- dates (UTC calendar days) ----
const DAY = 86_400_000;
export const toDays = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY;
export const fromDays = (days: number) => new Date(days * DAY).toISOString().slice(0, 10);

/** Hire dates 2012-01-01 … anchor, more in recent years (the company grew). */
function hireDate(rng: Rng): string {
  const years: [number, number][] = [];
  for (let y = 2012; y <= 2026; y++) years.push([y, y === 2026 ? 0.75 * (y - 2011) : y - 2011]);
  const year = weighted(rng, years);
  const start = toDays(`${year}-01-01`);
  const end = Math.min(toDays(`${year}-12-31`), toDays(SEED_ANCHOR));
  return fromDays(Math.floor(between(rng, start, end + 1)));
}

/** Within-company spread: half the market log-spread, kept within 0.75–1.33× (D60). */
function noise(rng: Rng, country: Country): number {
  const { p25, p75 } = MARKET_SPREAD[country];
  const sigma = (Math.log(p75 / p25) / (2 * 0.6745)) * 0.5;
  for (;;) {
    const f = Math.exp(sigma * normal(rng));
    if (f >= 0.75 && f <= 1.33) return f;
  }
}

const roundPay = (amount: number, currency: Currency) => {
  const step = currency === 'INR' || currency === 'JPY' ? 1000 : 100;
  return Math.max(step, Math.round(amount / step) * step);
};

const emailOf = (first: string, last: string) =>
  `${first}.${last}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss').replace(/ı/g, 'i').replace(/[^A-Za-z.]/g, '')
    .toLowerCase() + '@acme.example';

type Person = SeedEmployee & { country: Country; department: Department; role: Role; level: number; salary: number };

export function generateSeed(): Seed {
  const rng = mulberry32(SEED_NUMBER);
  const countries = shuffle(rng, (Object.keys(COUNTS) as Country[]).flatMap((c) => Array<Country>(COUNTS[c]).fill(c)));
  const names = new Set<string>();
  const emails = new Set<string>();

  const people: Person[] = countries.map((country) => {
    const gender = weighted(rng, GENDER_WEIGHTS);
    const lists = NAMES[country];
    const given = gender === 'female' ? lists.female : gender === 'male' ? lists.male : lists.neutral;
    let firstName: string, lastName: string, workEmail: string;
    do {
      firstName = pick(rng, given);
      lastName = pick(rng, lists.last);
      workEmail = emailOf(firstName, lastName);
    } while (names.has(`${firstName} ${lastName}`) || emails.has(workEmail));
    names.add(`${firstName} ${lastName}`);
    emails.add(workEmail);

    const department = weighted(rng, DEPARTMENT_WEIGHTS);
    const role = weighted(rng, ROLE_WEIGHTS[department]);
    const { minLevel, maxLevel } = ROLES[role];
    const level = weighted(rng, LEVEL_WEIGHTS.map((w, i) => [i + 1, i + 1 >= minLevel && i + 1 <= maxLevel ? w : 0] as const));
    const gap = gender === 'male' ? 0 : SAME_JOB_GAP[country];
    const salary = roundPay(band(country, role, department, level) * (1 - gap) * noise(rng, country), CURRENCY[country]);
    return {
      code: '', firstName, lastName, gender, workEmail, hireDate: hireDate(rng), leaveDate: null, leaveReason: null,
      country, department, role, level, salary,
    };
  });

  // Codes follow hire order: E000001 is the longest-serving person.
  people.sort((a, b) => (a.hireDate < b.hireDate ? -1 : a.hireDate > b.hireDate ? 1 : 0));
  people.forEach((p, i) => (p.code = `E${String(i + 1).padStart(6, '0')}`));

  const changes: SeedChange[] = people.map((p) => ({
    code: p.code, effectiveDate: p.hireDate, country: p.country, department: p.department, role: p.role, level: p.level,
    managerSet: true, managerCode: null, salary: p.salary, currency: CURRENCY[p.country], note: null,
  }));
  const employees = people.map(({ code, firstName, lastName, gender, workEmail, hireDate, leaveDate, leaveReason }) => ({
    code, firstName, lastName, gender, workEmail, hireDate, leaveDate, leaveReason,
  }));
  return { employees, changes, leaveEvents: [], outliers: [] };
}
