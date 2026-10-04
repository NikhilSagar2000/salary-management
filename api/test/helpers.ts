import type pg from 'pg';
import request from 'supertest';
import { afterAll } from 'vitest';
import type { ModelEvent, ModelFn, ModelRequest } from '../src/assistant/model.ts';
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
export async function testApp(opts: { now?: string; production?: boolean; model?: ModelFn; openRouter?: { baseUrl: string; apiKey: string } } = {}) {
  const db = testPool();
  await migrate(db);
  const { rows } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
  if (rows.length) await db.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  const clock = mutableClock(opts.now ?? '2026-10-01T12:00:00Z');
  const config = {
    passwordHash: await passwordHash,
    production: opts.production ?? false,
    openRouter: opts.openRouter ?? { baseUrl: 'http://127.0.0.1:9/api/v1', apiKey: 'test-only-key' },
  };
  const model = opts.model ?? scriptedModel([]).model;
  return { app: createApp({ db, clock, config, model }), db, clock, config };
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

type Person = {
  code: string; firstName?: string; lastName?: string; gender?: string; workEmail?: string; hireDate?: string; leaveDate?: string;
  country?: string; department?: string; role?: string; level?: number; salary?: number;
};
const CURRENCY_OF: Record<string, string> = { US: 'USD', IN: 'INR', GB: 'GBP', DE: 'EUR', BR: 'BRL', JP: 'JPY' };

/** Inserts people straight into the database (fast fixture for list and stats tests). */
export async function insertPeople(db: pg.Pool, people: Person[]) {
  for (const p of people) {
    const country = p.country ?? 'US';
    const { rows } = await db.query(
      `INSERT INTO employees (code, first_name, last_name, gender, work_email, hire_date, leave_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [p.code, p.firstName ?? 'Test', p.lastName ?? p.code, p.gender ?? 'female', p.workEmail ?? `${p.code.toLowerCase()}@acme.example`,
        p.hireDate ?? '2020-01-01', p.leaveDate ?? null],
    );
    await db.query(
      `INSERT INTO job_changes (employee_id, effective_date, country, department, role, level, manager_set, salary, currency)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
      [rows[0].id, p.hireDate ?? '2020-01-01', country, p.department ?? 'Engineering', p.role ?? 'Software Engineer', p.level ?? 3,
        p.salary ?? 100000, CURRENCY_OF[country]],
    );
  }
}

export const code = (n: number) => `E${String(n).padStart(6, '0')}`;

/** A fake model that plays one scripted list of events per call and records every request. */
export function scriptedModel(rounds: ModelEvent[][]) {
  const requests: ModelRequest[] = [];
  const model: ModelFn = async function* (req) {
    requests.push(structuredClone({ ...req, signal: undefined }) as unknown as ModelRequest);
    for (const event of rounds[requests.length - 1] ?? [{ type: 'token', text: '(no more script)' }, { type: 'done' }]) yield event;
  };
  return { model, requests };
}
