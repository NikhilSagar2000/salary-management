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
