import { expect, test } from 'vitest';
import { newEmployee, signIn, testApp } from './helpers.ts';

const STALE = 'Someone changed this employee after you opened the page. Reload to see the latest, then make your change again.';

/** Every write to an employee, as (agent, version) → request. Tasks 7–9 add theirs here. */
const writes = {
  details: (agent: Awaited<ReturnType<typeof signIn>>, version: number) =>
    agent.patch('/api/employees/E000123').send({ version, firstName: `Name${version}` }),
};

test.fails.each(Object.entries(writes))('an old version gets 409 and nothing changes (%s)', async (_name, write) => {
  const { app, db } = await testApp();
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee);
  expect((await write(agent, 1)).status).toBeLessThan(300);
  const snapshot = async () => (await db.query('SELECT e.*, (SELECT count(*) FROM job_changes) AS c, (SELECT count(*) FROM leave_events) AS l FROM employees e')).rows;
  const before = await snapshot();
  const stale = await write(agent, 1);
  expect(stale.status).toBe(409);
  expect(stale.body).toEqual({ error: STALE });
  expect(await snapshot()).toEqual(before);
});

test.fails('a write to an unknown employee gets 404', async () => {
  const { app } = await testApp();
  const agent = await signIn(app);
  const res = await agent.patch('/api/employees/E000999').send({ version: 1, firstName: 'X' });
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'No employee with code E000999.' });
});
