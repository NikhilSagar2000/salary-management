import { expect, test } from 'vitest';
import { newEmployee, signIn, testApp } from './helpers.ts';

const STALE = 'Someone changed this employee after you opened the page. Reload to see the latest, then make your change again.';
type Agent = Awaited<ReturnType<typeof signIn>>;

/** Every write to an employee: optional preparation, then the write at a given version. */
const writes: Record<string, { prepare?: (agent: Agent) => Promise<unknown>; write: (agent: Agent, version: number) => Promise<{ status: number; body: unknown }> }> = {
  details: { write: (agent, version) => agent.patch('/api/employees/E000123').send({ version, firstName: `Name${version}` }) },
  'job change': { write: (agent, version) => agent.post('/api/employees/E000123/changes').send({ version, effectiveDate: '2025-01-01', level: 4 }) },
  cancel: {
    prepare: (agent) => agent.post('/api/employees/E000123/changes').send({ version: 1, effectiveDate: '2027-01-01', salary: 150000 }),
    write: (agent, version) => agent.post('/api/employees/E000123/changes/2/cancel').send({ version }),
  },
  leave: { write: (agent, version) => agent.post('/api/employees/E000123/leave').send({ version, leaveDate: '2026-12-31' }) },
  'undo leave': {
    prepare: (agent) => agent.post('/api/employees/E000123/leave').send({ version: 1, leaveDate: '2026-12-31' }),
    write: (agent, version) => agent.post('/api/employees/E000123/undo-leave').send({ version }),
  },
};

test.each(Object.entries(writes))('an old version gets 409 and nothing changes (%s)', async (_name, { prepare, write }) => {
  const { app, db } = await testApp();
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee);
  await prepare?.(agent);
  const version = (await db.query('SELECT version FROM employees')).rows[0].version;
  expect((await write(agent, version)).status).toBeLessThan(300);
  const snapshot = async () =>
    (await db.query('SELECT e.*, (SELECT json_agg(c ORDER BY id) FROM job_changes c) AS c, (SELECT count(*) FROM leave_events) AS l FROM employees e')).rows;
  const before = await snapshot();
  const stale = await write(agent, version);
  expect(stale.status).toBe(409);
  expect(stale.body).toEqual({ error: STALE });
  expect(await snapshot()).toEqual(before);
});

test('a write to an unknown employee gets 404', async () => {
  const { app } = await testApp();
  const agent = await signIn(app);
  const res = await agent.patch('/api/employees/E000999').send({ version: 1, firstName: 'X' });
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'No employee with code E000999.' });
});
