// The seed (SEED-1…10): exactly 10,000 employees, identical every run, with realistic pay (D59–D62).
import { COUNTRY_NAMES, CURRENCY, ROLES, type Country, type Currency, type Department, type Gender, type Role } from '@acme/shared';
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

type Person = SeedEmployee & {
  hireCountry: Country; country: Country; department: Department; role: Role; hireLevel: number; level: number;
  salary: number; gapFactor: number; events: CareerEvent[];
};

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
    const gapFactor = gender === 'male' ? 1 : 1 - SAME_JOB_GAP[country];
    const hire = hireDate(rng);
    const { leaveDate, leaveReason } = leaving(rng, hire);
    const { events, hireLevel, now } = career(rng, { country, level, minLevel, hire, end: leaveDate ?? SEED_ANCHOR });
    const salary = roundPay(band(now, role, department, level) * gapFactor * noise(rng, now), CURRENCY[now]);
    return {
      code: '', firstName, lastName, gender, workEmail, hireDate: hire, leaveDate, leaveReason,
      hireCountry: country, country: now, department, role, hireLevel, level, salary, gapFactor, events,
    };
  });

  // Codes follow hire order: E000001 is the longest-serving person.
  people.sort((a, b) => (a.hireDate < b.hireDate ? -1 : a.hireDate > b.hireDate ? 1 : 0));
  people.forEach((p, i) => (p.code = `E${String(i + 1).padStart(6, '0')}`));

  const outliers = placeOutliers(rng, people.filter((p) => p.leaveDate === null || p.leaveDate > SEED_ANCHOR));

  const managers = assignManagers(rng, people);
  const changes = people.flatMap((p) => withManagers(history(p), managers.get(p.code)!));
  const employees = people.map(({ code, firstName, lastName, gender, workEmail, hireDate, leaveDate, leaveReason }) => ({
    code, firstName, lastName, gender, workEmail, hireDate, leaveDate, leaveReason,
  }));
  const leaveEvents: SeedLeaveEvent[] = people
    .filter((p) => p.leaveDate)
    .map((p) => ({ code: p.code, kind: 'left', leaveDate: p.leaveDate!, reason: p.leaveReason }));
  return { employees, changes, leaveEvents, outliers };
}

// ---- careers ----
type CareerEvent =
  | { day: number; kind: 'raise'; pct: number }
  | { day: number; kind: 'promotion'; pct: number }
  | { day: number; kind: 'move'; from: Country; to: Country; fromNoise: number };

const RAISE: Record<Country, [number, number]> = {
  US: [0.03, 0.05], GB: [0.03, 0.05], DE: [0.02, 0.04], JP: [0.01, 0.03], IN: [0.07, 0.11], BR: [0.05, 0.09],
};
const LEAVE_REASONS = ['Resigned', 'Moved to another company', 'Relocated', 'Retired', 'End of contract', 'Career change', 'Personal reasons', null];

/** About 12% of people hired before March 2026 have left, at least six months after joining (D62). */
function leaving(rng: Rng, hire: string) {
  if (!(hire < '2026-03-01' && rng() < 0.12)) return { leaveDate: null, leaveReason: null };
  const leaveDate = fromDays(Math.floor(between(rng, toDays(hire) + 180, toDays(SEED_ANCHOR) + 1)));
  return { leaveDate, leaveReason: pick(rng, LEAVE_REASONS) };
}

/**
 * Promotions every 2–4 years (as many as the level allows), a raise every 1 April after the first nine months,
 * and for about 1% of people with 2+ years a move to another country (D62). `level` is the level at `end`.
 */
function career(rng: Rng, p: { country: Country; level: number; minLevel: number; hire: string; end: string }) {
  const hireDay = toDays(p.hire);
  const endDay = toDays(p.end);
  const events: CareerEvent[] = [];

  const chances: number[] = [];
  for (let day = hireDay + Math.floor(between(rng, 730, 1460)); day <= endDay - 30; day += Math.floor(between(rng, 730, 1460))) {
    chances.push(fromDays(day).endsWith('-04-01') ? day + 1 : day);
  }
  const promotions = shuffle(rng, chances).slice(0, p.level - p.minLevel).sort((a, b) => a - b);
  for (const day of promotions) events.push({ day, kind: 'promotion', pct: between(rng, 0.08, 0.15) });

  let move: { day: number; to: Country } | null = null;
  if (endDay - hireDay > 730 && rng() < 0.012) {
    const to = pick(rng, (Object.keys(COUNTS) as Country[]).filter((c) => c !== p.country));
    move = { day: Math.floor(between(rng, hireDay + 365, endDay - 180)), to };
    events.push({ day: move.day, kind: 'move', from: p.country, to, fromNoise: 0 });
  }

  for (let year = Number(p.hire.slice(0, 4)); year <= 2026; year++) {
    const day = toDays(`${year}-04-01`);
    if (day <= hireDay + 270 || day > endDay) continue;
    const country = move && day >= move.day ? move.to : p.country;
    events.push({ day, kind: 'raise', pct: between(rng, ...RAISE[country]) });
  }
  for (const e of events) if (e.kind === 'move') e.fromNoise = noise(rng, e.from);

  const order = { raise: 0, promotion: 1, move: 2 };
  events.sort((a, b) => a.day - b.day || order[a.kind] - order[b.kind]);
  return { events, hireLevel: p.level - promotions.length, now: move ? move.to : p.country };
}

/** The person's job changes: the hire, then each event, with salaries worked back from today's pay. */
function history(p: Person): SeedChange[] {
  // Walk backwards from current pay to find the pay in force after each event and at hire.
  const after: number[] = new Array(p.events.length);
  let salary = p.salary;
  let level = p.level;
  for (let i = p.events.length - 1; i >= 0; i--) {
    const e = p.events[i]!;
    after[i] = salary;
    if (e.kind === 'raise') salary /= 1 + e.pct;
    if (e.kind === 'promotion') {
      salary /= 1 + e.pct;
      level -= 1;
    }
    if (e.kind === 'move') salary = band(e.from, p.role, p.department, level) * p.gapFactor * e.fromNoise;
  }
  const base = { code: p.code, country: null, department: null, role: null, level: null, managerSet: false, managerCode: null, note: null };
  const changes: SeedChange[] = [{
    ...base, effectiveDate: p.hireDate, country: p.hireCountry, department: p.department, role: p.role, level: p.hireLevel,
    managerSet: true, salary: roundPay(salary, CURRENCY[p.hireCountry]), currency: CURRENCY[p.hireCountry],
  }];
  let country = p.hireCountry;
  level = p.hireLevel;
  p.events.forEach((e, i) => {
    const date = fromDays(e.day);
    if (e.kind === 'move') country = e.to;
    const pay = { salary: roundPay(after[i]!, CURRENCY[country]), currency: CURRENCY[country] };
    if (e.kind === 'raise') changes.push({ ...base, ...pay, effectiveDate: date, note: 'Annual raise' });
    if (e.kind === 'promotion') changes.push({ ...base, ...pay, effectiveDate: date, level: ++level, note: `Promotion to L${level}` });
    if (e.kind === 'move') changes.push({ ...base, ...pay, effectiveDate: date, country, note: `Moved to ${COUNTRY_NAMES[country]}` });
  });
  return changes;
}

const OUTLIER_COUNT = 30;
const peerKey = (p: Person) => `${p.country}|${p.role}|${p.level}`;

function medianOf(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length / 2;
  return s.length % 2 ? s[Math.floor(m)]! : (s[m - 1]! + s[m]! ) / 2;
}

function peerMedians(people: Person[]) {
  const groups = new Map<string, number[]>();
  for (const p of people) {
    const xs = groups.get(peerKey(p)) ?? [];
    xs.push(p.salary);
    groups.set(peerKey(p), xs);
  }
  return new Map([...groups].map(([k, xs]) => [k, { median: medianOf(xs), n: xs.length }]));
}

/**
 * SEED-8: keeps everyone within 0.6–1.7× their peer median (country, role, level), then pays ~30 people
 * from peer groups of 20+ far from it: half above 2×, half below 0.5×. Returns their codes.
 */
function placeOutliers(rng: Rng, employed: Person[]): string[] {
  for (let pass = 0; pass < 3; pass++) {
    const medians = peerMedians(employed);
    for (const p of employed) {
      const { median } = medians.get(peerKey(p))!;
      const currency = CURRENCY[p.country];
      if (p.salary < 0.6 * median) p.salary = roundPay(0.6 * median, currency);
      if (p.salary > 1.7 * median) p.salary = roundPay(1.7 * median, currency);
    }
  }
  const medians = peerMedians(employed);
  const usedGroups = new Set<string>();
  const chosen: Person[] = [];
  for (const p of shuffle(rng, employed.filter((p) => medians.get(peerKey(p))!.n >= 20))) {
    if (chosen.length === OUTLIER_COUNT) break;
    if (usedGroups.has(peerKey(p))) continue;
    usedGroups.add(peerKey(p));
    const high = chosen.length % 2 === 0;
    const factor = high ? between(rng, 2.0, 2.4) : between(rng, 0.4, 0.48);
    p.salary = roundPay(medians.get(peerKey(p))!.median * factor, CURRENCY[p.country]);
    chosen.push(p);
  }
  return chosen.map((p) => p.code).sort();
}

// ---- managers (SEED-10) ----
const levelOn = (p: Person, day: number) => p.hireLevel + p.events.filter((e) => e.kind === 'promotion' && e.day <= day).length;
const countryOn = (p: Person, day: number) => {
  const move = p.events.find((e) => e.kind === 'move' && e.day <= day);
  return move?.kind === 'move' ? move.to : p.hireCountry;
};
const employedOn = (p: Person, day: number) => toDays(p.hireDate) <= day && (p.leaveDate === null || toDays(p.leaveDate) > day);

/** Days after `day` on which `m` stops being able to manage someone: leaving or moving country. */
const managerEnds = (m: Person) => [
  ...(m.leaveDate ? [toDays(m.leaveDate)] : []),
  ...m.events.filter((e) => e.kind === 'move').map((e) => e.day),
];

/**
 * Each person's manager over time: the most junior employee who outranks them in the same country and
 * department. Re-chosen on hire, on their promotions and moves, and when the manager leaves or moves,
 * so a manager is always employed, more senior (no loops possible) and in the same place.
 */
function assignManagers(rng: Rng, people: Person[]) {
  const pools = new Map<string, Person[]>();
  for (const p of people) {
    const places = new Set([p.hireCountry, ...p.events.filter((e) => e.kind === 'move').map((e) => (e as { to: Country }).to)]);
    for (const c of places) pools.set(`${c}|${p.department}`, [...(pools.get(`${c}|${p.department}`) ?? []), p]);
  }
  const valid = (m: Person, p: Person, day: number) =>
    m !== p && employedOn(m, day) && countryOn(m, day) === countryOn(p, day) && levelOn(m, day) > levelOn(p, day);
  const choose = (p: Person, day: number): Person | null => {
    const candidates = (pools.get(`${countryOn(p, day)}|${p.department}`) ?? []).filter((m) => valid(m, p, day));
    if (!candidates.length) return null;
    const lowest = Math.min(...candidates.map((m) => levelOn(m, day)));
    return pick(rng, candidates.filter((m) => levelOn(m, day) === lowest));
  };

  const result = new Map<string, { day: number; managerCode: string | null }[]>();
  for (const p of people) {
    const end = p.leaveDate ? toDays(p.leaveDate) - 1 : toDays(SEED_ANCHOR);
    const checks = [toDays(p.hireDate), ...p.events.filter((e) => e.kind !== 'raise').map((e) => e.day)];
    const out: { day: number; managerCode: string | null }[] = [];
    let current: Person | null = null;
    while (checks.length) {
      checks.sort((a, b) => a - b);
      const day = checks.shift()!;
      if (day > end) break;
      if (out.length && current && valid(current, p, day)) continue;
      const next = choose(p, day);
      if (!out.length || next !== current) out.push({ day, managerCode: next?.code ?? null });
      current = next;
      if (current) for (const stop of managerEnds(current)) if (stop > day && stop <= end) checks.push(stop);
    }
    result.set(p.code, out);
  }
  return result;
}

/** Puts the manager on the hire change and adds a change for each later manager switch (after other changes that day). */
function withManagers(changes: SeedChange[], managers: { day: number; managerCode: string | null }[]): SeedChange[] {
  const [hire, ...rest] = managers;
  changes[0] = { ...changes[0]!, managerSet: true, managerCode: hire?.managerCode ?? null };
  const extra = rest.map((m): SeedChange => ({
    code: changes[0]!.code, effectiveDate: fromDays(m.day), country: null, department: null, role: null, level: null,
    managerSet: true, managerCode: m.managerCode, salary: null, currency: null, note: 'New manager',
  }));
  return [...changes, ...extra].sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0));
}
