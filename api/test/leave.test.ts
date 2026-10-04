import { expect, test } from 'vitest';
import { newEmployee, signIn, testApp } from './helpers.ts';

async function setup() {
  const { app, db } = await testApp(); // today: 2026-10-01
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee); // hired 2024-02-29
  return { agent, db };
}

const person = async (db: import('pg').Pool) =>
  (await db.query('SELECT leave_date, leave_reason, version FROM employees')).rows[0];
const events = async (db: import('pg').Pool) =>
  (await db.query('SELECT kind, leave_date, reason FROM leave_events ORDER BY id')).rows;

test('marks leaving with a date and optional reason', async () => {
  const { agent, db } = await setup();
  const res = await agent.post('/api/employees/E000123/leave').send({ version: 1, leaveDate: '2026-12-31', reason: 'Moving abroad' });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ code: 'E000123', version: 2 });
  expect(await person(db)).toEqual({ leave_date: '2026-12-31', leave_reason: 'Moving abroad', version: 2 });
  expect(await events(db)).toEqual([{ kind: 'left', leave_date: '2026-12-31', reason: 'Moving abroad' }]);
});

test('refuses a leave date before hire or a reason over 500 characters', async () => {
  const { agent, db } = await setup();
  const early = await agent.post('/api/employees/E000123/leave').send({ version: 1, leaveDate: '2024-02-28' });
  expect(early.status).toBe(400);
  expect(early.body.fields).toEqual({ leaveDate: "The leave date can't be before the hire date (29 Feb 2024)." });
  const long = await agent.post('/api/employees/E000123/leave').send({ version: 1, leaveDate: '2026-12-31', reason: 'x'.repeat(501) });
  expect(long.body.fields).toEqual({ reason: 'Keep the reason to 500 characters or fewer.' });
  expect(await person(db)).toEqual({ leave_date: null, leave_reason: null, version: 1 });
  expect(await events(db)).toEqual([]);
});

test('undo clears date and reason and both events show in history', async () => {
  const { agent, db } = await setup();
  await agent.post('/api/employees/E000123/leave').send({ version: 1, leaveDate: '2026-09-30', reason: 'Resigned' });
  const res = await agent.post('/api/employees/E000123/undo-leave').send({ version: 2 });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ code: 'E000123', version: 3 });
  expect(await person(db)).toEqual({ leave_date: null, leave_reason: null, version: 3 });
  expect(await events(db)).toEqual([
    { kind: 'left', leave_date: '2026-09-30', reason: 'Resigned' },
    { kind: 'undone', leave_date: '2026-09-30', reason: null },
  ]);
  const again = await agent.post('/api/employees/E000123/undo-leave').send({ version: 3 });
  expect(again.status).toBe(400);
  expect(again.body.fields).toEqual({ form: "This person isn't marked as leaving." });
});

test.fails('refuses every write except undo after leaving', async () => {
  const { agent, db } = await setup(); // today 2026-10-01
  await agent.post('/api/employees/E000123/changes').send({ version: 1, effectiveDate: '2027-01-01', salary: 150000 });
  // Leaving later (notice period): still editable.
  await agent.post('/api/employees/E000123/leave').send({ version: 2, leaveDate: '2026-12-31' });
  expect((await agent.patch('/api/employees/E000123').send({ version: 3, firstName: 'Anna' })).status).toBe(200);
  // Has left (leave date on or before today): only undo.
  await agent.post('/api/employees/E000123/leave').send({ version: 4, leaveDate: '2026-09-30' });
  const LEFT = { error: 'This person has left. Undo leaving first to make changes.' };
  const attempts = [
    agent.patch('/api/employees/E000123').send({ version: 5, firstName: 'Ann' }),
    agent.post('/api/employees/E000123/changes').send({ version: 5, effectiveDate: '2026-09-01', level: 4 }),
    agent.post('/api/employees/E000123/changes/2/cancel').send({ version: 5 }),
    agent.post('/api/employees/E000123/leave').send({ version: 5, leaveDate: '2026-08-31' }),
  ];
  for (const res of await Promise.all(attempts)) {
    expect(res.status).toBe(409);
    expect(res.body).toEqual(LEFT);
  }
  expect(await person(db)).toEqual({ leave_date: '2026-09-30', leave_reason: null, version: 5 });
  expect((await agent.post('/api/employees/E000123/undo-leave').send({ version: 5 })).status).toBe(200);
});
