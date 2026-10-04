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

test('a country change needs a salary in the new currency', async () => {
  const { db, change } = await setup();
  const noSalary = await change({ effectiveDate: '2025-03-01', country: 'DE' });
  expect(noSalary.status).toBe(400);
  expect(noSalary.body.fields).toEqual({ salary: 'Moving to another country needs a salary in the new currency.' });
  expect((await change({ effectiveDate: '2025-03-01', country: 'DE', salary: 80000 })).status).toBe(201);
  expect(await stateOn(db, '2025-03-01')).toMatchObject({ country: 'DE', salary: 80000, currency: 'EUR' });
  expect((await change({ effectiveDate: '2026-01-01', salary: 84000 })).status).toBe(201);
  expect(await stateOn(db, '2026-01-01')).toMatchObject({ country: 'DE', salary: 84000, currency: 'EUR' });
});

test('refuses a relocation that would leave a later salary in the old currency', async () => {
  const { db, change } = await setup();
  expect((await change({ effectiveDate: '2027-01-01', salary: 140000 })).status).toBe(201); // scheduled, BRL
  const move = await change({ effectiveDate: '2026-11-01', country: 'DE', salary: 80000 });
  expect(move.status).toBe(400);
  expect(move.body.fields).toEqual({ country: 'A salary change on 1 Jan 2027 is in BRL; cancel it before moving this person to Germany.' });
  expect(await stateOn(db, '2027-01-02')).toMatchObject({ country: 'BR', salary: 140000, currency: 'BRL' });
});

test('manager must exist, not be the person, be employed on the date, and not form a loop', async () => {
  const { agent, db, change } = await setup();
  const person = (code: string, first: string, hireDate: string, extra = {}) =>
    agent.post('/api/employees').send({ ...newEmployee, code, firstName: first, lastName: 'Lima', workEmail: `${first}@acme.example`, hireDate, ...extra });
  expect((await person('E000200', 'Bruno', '2020-01-01')).status).toBe(201);
  expect((await person('E000300', 'Carla', '2026-06-01')).status).toBe(201);
  const field = async (body: Record<string, unknown>) => (await change(body)).body.fields?.managerCode;

  expect(await field({ effectiveDate: '2025-01-01', managerCode: 'E000999' })).toBe('No employee with code E000999.');
  expect(await field({ effectiveDate: '2025-01-01', managerCode: 'E000123' })).toBe("Someone can't be their own manager.");
  expect(await field({ effectiveDate: '2025-01-01', managerCode: 'E000300' })).toBe("Carla Lima isn't employed on 1 Jan 2025.");
  expect((await change({ effectiveDate: '2025-01-01', managerCode: 'E000200' })).status).toBe(201);

  const loop = await agent.post('/api/employees/E000200/changes').send({ version: 1, effectiveDate: '2025-06-01', managerCode: 'E000123' });
  expect(loop.body.fields).toEqual({ managerCode: 'That would make a reporting loop.' });

  expect((await change({ effectiveDate: '2025-09-01', managerCode: null })).status).toBe(201);
  expect((await stateOn(db, '2025-09-01')).manager_id).toBeNull();
  await db.query("UPDATE employees SET leave_date = '2025-12-31' WHERE code = 'E000200'");
  expect(await field({ effectiveDate: '2026-01-15', managerCode: 'E000200' })).toBe("Bruno Lima isn't employed on 15 Jan 2026.");

  const created = await person('E000400', 'Davi', '2025-01-01', { managerCode: 'E000999' });
  expect(created.body.fields).toEqual({ managerCode: 'No employee with code E000999.' });
  expect((await person('E000400', 'Davi', '2025-01-01', { managerCode: 'E000123' })).status).toBe(201);
});

test('a cancelled scheduled change stays in history and stops applying', async () => {
  const { agent, db, change } = await setup(); // today: 2026-10-01
  const raise = await change({ effectiveDate: '2027-01-01', salary: 150000 });
  const id = (await db.query("SELECT max(id) AS id FROM job_changes")).rows[0].id;
  const res = await agent.post(`/api/employees/E000123/changes/${id}/cancel`).send({ version: raise.body.version });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ code: 'E000123', version: 3 });
  expect((await stateOn(db, '2027-01-02')).salary).toBe(133000);
  const { rows } = await db.query('SELECT salary, cancelled_at IS NOT NULL AS cancelled FROM job_changes WHERE id = $1', [id]);
  expect(rows).toEqual([{ salary: 150000, cancelled: true }]);
});

test.fails('refuses to cancel a change dated today or earlier', async () => {
  const { app, db } = await testApp({ now: '2026-10-01T20:00:00Z' }); // 1 Oct in UTC, 2 Oct in Tokyo
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee);
  await agent.post('/api/employees/E000123/changes').send({ version: 1, effectiveDate: '2025-01-01', level: 4 });
  await agent.post('/api/employees/E000123/changes').send({ version: 2, effectiveDate: '2026-10-02', salary: 140000 });
  const [past, tomorrow] = (await db.query('SELECT id FROM job_changes ORDER BY id OFFSET 1')).rows.map((r) => r.id);
  const cancel = (id: number, version: number, tz?: string) => {
    const req = agent.post(`/api/employees/E000123/changes/${id}/cancel`);
    if (tz) req.set('X-Timezone', tz);
    return req.send({ version });
  };
  const old = await cancel(past, 3);
  expect(old.status).toBe(400);
  expect(old.body.fields).toEqual({ form: 'Only scheduled changes can be cancelled. Fix a past change by adding a new one.' });
  expect((await cancel(tomorrow, 3, 'Asia/Tokyo')).body.fields).toEqual({ form: 'Only scheduled changes can be cancelled. Fix a past change by adding a new one.' });
  expect((await cancel(tomorrow, 3, 'Europe/London')).status).toBe(200);
});
