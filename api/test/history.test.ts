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

test.fails("a change keeps the fields it doesn't touch", async () => {
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
