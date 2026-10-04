import { expect, test } from 'vitest';
import { newEmployee, signIn, testApp } from './helpers.ts';

async function setup() {
  const { app, db } = await testApp(); // today: 2026-10-01
  const agent = await signIn(app);
  let n = 200;
  const hire = async (extra: Record<string, unknown> = {}) => {
    const code = `E000${n++}`;
    const res = await agent.post('/api/employees').send({ ...newEmployee, code, workEmail: `${code}@acme.example`, ...extra });
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return code;
  };
  return { agent, db, hire };
}

test('returns status, current job and pay against peers', async () => {
  const { agent, hire } = await setup();
  // Peers: BR Software Engineer L3 — salaries 100k, 120k, 133k (Ana), 140k → median 126,500
  await hire({ salary: 100000 });
  await hire({ salary: 120000 });
  await hire({ salary: 140000 });
  await hire({ salary: 999000, level: 4 }); // not a peer (other level)
  await hire({ salary: 50000, hireDate: '2026-12-01' }); // starting: not counted
  await agent.post('/api/employees').send(newEmployee); // Ana, E000123, 133,000
  const res = await agent.get('/api/employees/E000123');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    code: 'E000123', firstName: 'Ana', lastName: 'Silva', gender: 'female', workEmail: 'ana.silva@acme.example',
    hireDate: '2024-02-29', leaveDate: null, leaveReason: null, status: 'active', version: 1,
    current: { country: 'BR', currency: 'BRL', department: 'Engineering', role: 'Software Engineer', level: 3, salary: 133000, manager: null },
    peers: { currency: 'BRL', median: 126500, min: 100000, max: 140000, headcount: 4, position: 5 },
  });
  const starting = await agent.get('/api/employees/E000204');
  expect(starting.body).toMatchObject({ status: 'starting', current: { salary: 50000 } });
  expect((await agent.get('/api/employees/E000999')).status).toBe(404);
});

test('shows the manager with a has-left flag and the direct reports', async () => {
  const { agent, hire } = await setup();
  const bruno = await hire({ firstName: 'Bruno', lastName: 'Lima', level: 5, role: 'Engineering Manager' });
  await agent.post('/api/employees').send({ ...newEmployee, managerCode: bruno });
  await hire({ firstName: 'Carla', lastName: 'Souza', managerCode: 'E000123', level: 2 });
  const left = await hire({ firstName: 'Davi', lastName: 'Rocha', managerCode: 'E000123', level: 2 });
  await agent.post(`/api/employees/${left}/leave`).send({ version: 1, leaveDate: '2026-09-15' });

  const ana = await agent.get('/api/employees/E000123');
  expect(ana.body.current.manager).toEqual({ code: bruno, name: 'Bruno Lima', hasLeft: false });
  expect(ana.body.reports).toEqual([{ code: 'E000201', name: 'Carla Souza' }]);

  await agent.post(`/api/employees/${bruno}/leave`).send({ version: 1, leaveDate: '2026-09-30' });
  expect((await agent.get('/api/employees/E000123')).body.current.manager).toEqual({ code: bruno, name: 'Bruno Lima', hasLeft: true });
});

test("timeline lists each change with from → to, and marks scheduled, cancelled, won't-apply and leave events", async () => {
  const { agent, db } = await setup();
  await agent.post('/api/employees').send(newEmployee);
  const post = (body: object) => agent.post('/api/employees/E000123/changes').send(body);
  await post({ version: 1, effectiveDate: '2025-01-01', level: 4, salary: 145000, note: 'Promotion' });
  await post({ version: 2, effectiveDate: '2027-01-01', salary: 150000 });
  await post({ version: 3, effectiveDate: '2027-02-01', salary: 155000 });
  const cancelId = (await db.query("SELECT id FROM job_changes WHERE effective_date = '2027-01-01'")).rows[0].id;
  await agent.post(`/api/employees/E000123/changes/${cancelId}/cancel`).send({ version: 4 });
  await agent.post('/api/employees/E000123/leave').send({ version: 5, leaveDate: '2026-12-31', reason: 'Moving abroad' });

  const { timeline } = (await agent.get('/api/employees/E000123')).body;
  const brl = (amount: number | null) => (amount === null ? null : { amount, currency: 'BRL' });
  expect(timeline.map(({ id: _id, ...rest }: { id?: number }) => rest)).toEqual([
    {
      type: 'change', date: '2024-02-29', hire: true, note: null, scheduled: false, cancelled: false, cancelledOn: null, wontApply: false,
      changes: [
        { field: 'country', from: null, to: 'BR' },
        { field: 'department', from: null, to: 'Engineering' },
        { field: 'role', from: null, to: 'Software Engineer' },
        { field: 'level', from: null, to: 3 },
        { field: 'salary', from: null, to: brl(133000) },
      ],
    },
    {
      type: 'change', date: '2025-01-01', hire: false, note: 'Promotion', scheduled: false, cancelled: false, cancelledOn: null, wontApply: false,
      changes: [{ field: 'level', from: 3, to: 4 }, { field: 'salary', from: brl(133000), to: brl(145000) }],
    },
    { type: 'left', date: '2026-12-31', reason: 'Moving abroad' },
    {
      type: 'change', date: '2027-01-01', hire: false, note: null, scheduled: true, cancelled: true, cancelledOn: '2026-10-01', wontApply: false,
      changes: [{ field: 'salary', from: brl(145000), to: brl(150000) }],
    },
    {
      type: 'change', date: '2027-02-01', hire: false, note: null, scheduled: true, cancelled: false, cancelledOn: null, wontApply: true,
      changes: [{ field: 'salary', from: brl(145000), to: brl(155000) }],
    },
  ]);
});

test("a cancelled change says when it was cancelled, as a date in HR's timezone (EMP-11)", async () => {
  const { app, db } = await testApp({ now: '2026-10-01T20:00:00Z' }); // already 2 Oct in Tokyo
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee);
  await agent.post('/api/employees/E000123/changes').send({ version: 1, effectiveDate: '2027-01-01', salary: 150000 });
  const id = (await db.query("SELECT id FROM job_changes WHERE effective_date = '2027-01-01'")).rows[0].id;
  await agent.post(`/api/employees/E000123/changes/${id}/cancel`).send({ version: 2 });
  const cancelledOn = async (tz: string) =>
    (await agent.get('/api/employees/E000123').set('X-Timezone', tz)).body.timeline.find((e: { cancelled?: boolean }) => e.cancelled).cancelledOn;
  expect(await cancelledOn('UTC')).toBe('2026-10-01');
  expect(await cancelledOn('Asia/Tokyo')).toBe('2026-10-02');
});
