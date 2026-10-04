import type pg from 'pg';
import { expect, test } from 'vitest';
import { newEmployee, signIn, testApp } from './helpers.ts';

async function setup() {
  const { app, db } = await testApp();
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee); // BR, Engineering, Software Engineer L3, 133000 BRL, hired 2024-02-29
  let version = 1;
  const change = async (body: Record<string, unknown>) => {
    const res = await agent.post('/api/employees/E000123/changes').send({ version, ...body });
    if (res.status === 201) version = res.body.version;
    return res;
  };
  return { agent, db, change };
}

const stateOn = async (db: pg.Pool, date: string) =>
  (await db.query('SELECT country, department, role, level, manager_id, salary, currency FROM employee_state($1)', [date])).rows[0];

test("a change keeps the fields it doesn't touch", async () => {
  const { db, change } = await setup();
  const res = await change({ effectiveDate: '2025-01-01', level: 4 });
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ code: 'E000123', version: 2 });
  expect(await stateOn(db, '2024-12-31')).toEqual({
    country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 3, manager_id: null, salary: 133000, currency: 'BRL',
  });
  expect(await stateOn(db, '2025-06-01')).toEqual({
    country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 4, manager_id: null, salary: 133000, currency: 'BRL',
  });
});

test("a change dated before a scheduled one leaves the scheduled one's fields intact", async () => {
  const { db, change } = await setup();
  expect((await change({ effectiveDate: '2027-01-01', salary: 110000 })).status).toBe(201); // scheduled raise
  expect((await change({ effectiveDate: '2026-11-01', role: 'Data Engineer', level: 4, salary: 105000 })).status).toBe(201);
  expect(await stateOn(db, '2026-11-15')).toMatchObject({ role: 'Data Engineer', level: 4, salary: 105000 });
  expect(await stateOn(db, '2027-01-02')).toMatchObject({ role: 'Data Engineer', level: 4, salary: 110000, currency: 'BRL' });
});

test('refuses a change before hire, after leaving, or changing nothing', async () => {
  const { db, change } = await setup();
  const before = await change({ effectiveDate: '2024-02-28', level: 4 });
  expect(before.status).toBe(400);
  expect(before.body.fields).toEqual({ effectiveDate: "The change can't be dated before the hire date (29 Feb 2024)." });
  const nothing = await change({ effectiveDate: '2025-01-01', note: 'just a note' });
  expect(nothing.status).toBe(400);
  expect(nothing.body.fields).toEqual({ form: 'Change at least one of country, department, role, level, manager or salary.' });
  await db.query("UPDATE employees SET leave_date = '2026-06-30'");
  const after = await change({ effectiveDate: '2026-07-01', level: 4 });
  expect(after.status).toBe(400);
  expect(after.body.fields).toEqual({ effectiveDate: "The change can't be dated after the leave date (30 Jun 2026)." });
  expect((await db.query('SELECT count(*) AS n, max(version) AS v FROM job_changes, employees')).rows[0]).toEqual({ n: 1, v: 1 });
});

test('refuses a department, role and level combination not allowed on that date', async () => {
  const { db, change } = await setup();
  const wrongDept = await change({ effectiveDate: '2025-01-01', department: 'Sales' });
  expect(wrongDept.status).toBe(400);
  expect(wrongDept.body.fields).toEqual({ role: "Software Engineer isn't a role in Sales." });
  expect((await change({ effectiveDate: '2025-01-01', department: 'Sales', role: 'Account Executive' })).status).toBe(201);
  expect((await change({ effectiveDate: '2027-01-01', level: 6 })).status).toBe(201); // scheduled: Account Executive L6
  const breaksLater = await change({ effectiveDate: '2026-11-01', role: 'Sales Development Representative', level: 2 });
  expect(breaksLater.status).toBe(400);
  expect(breaksLater.body.fields).toEqual({ level: 'On 1 Jan 2027: Sales Development Representative goes from L1 to L3.' });
  expect((await db.query('SELECT count(*) AS n FROM job_changes')).rows[0].n).toBe(3);
});
