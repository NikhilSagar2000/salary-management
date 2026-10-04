import { expect, test } from 'vitest';
import { code, insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1]) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  const agent = await signIn(app);
  // The pay overview's cells (department × level); fixtures default to Engineering, L3.
  return { agent, db, cells: async (country: string) => (await agent.get(`/api/pay-overview?country=${country}`)).body.cells };
}

test('median is percentile_cont rounded half away from zero', async () => {
  const { cells } = await setup([
    { code: 'E000001', country: 'US', salary: 100000 },
    { code: 'E000002', country: 'US', salary: 100001 },
    { code: 'E000003', country: 'IN', salary: 2000000 },
    { code: 'E000004', country: 'IN', salary: 2000003 },
    { code: 'E000005', country: 'IN', salary: 9000000 },
  ]);
  expect((await cells('US'))[0].median).toBe(100001); // 100,000.5 rounds up, not to the even 100,000
  expect((await cells('IN'))[0].median).toBe(2000003); // odd count: the middle value
});

test('counts active and leaving, not starting or left (STATS-2)', async () => {
  const { cells, agent } = await setup([
    { code: 'E000001', country: 'US', salary: 100000 }, // active
    { code: 'E000002', country: 'US', salary: 200000, leaveDate: '2026-12-31' }, // leaving
    { code: 'E000003', country: 'US', salary: 900000, hireDate: '2026-12-01' }, // starting
    { code: 'E000004', country: 'US', salary: 10000, leaveDate: '2026-09-01' }, // left
  ]);
  expect(await cells('US')).toEqual([{ department: 'Engineering', level: 3, median: 150000, min: 100000, max: 200000, headcount: 2 }]);
  expect((await agent.get('/api/employees')).body.total).toBe(3); // the starting person is listed, just not counted
});

test('overview gives department × level cells for one country', async () => {
  const { agent } = await setup([
    { code: 'E000001', country: 'US', department: 'Sales', role: 'Account Executive', level: 2, salary: 80000 },
    { code: 'E000002', country: 'US', level: 3, salary: 120000 },
    { code: 'E000003', country: 'US', level: 3, salary: 140000 },
    { code: 'E000004', country: 'US', level: 4, salary: 170000 },
    { code: 'E000005', country: 'IN', level: 3, salary: 1500000 }, // other country
    { code: 'E000006', country: 'US', level: 3, salary: 999000, leaveDate: '2026-09-01' }, // left
    { code: 'E000007', country: 'US', level: 3, salary: 1000, hireDate: '2026-12-01' }, // starting
  ]);
  const res = await agent.get('/api/pay-overview?country=US');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    country: 'US',
    currency: 'USD',
    cells: [
      { department: 'Engineering', level: 3, median: 130000, min: 120000, max: 140000, headcount: 2 },
      { department: 'Engineering', level: 4, median: 170000, min: 170000, max: 170000, headcount: 1 },
      { department: 'Sales', level: 2, median: 80000, min: 80000, max: 80000, headcount: 1 },
    ],
  });
  const missing = await agent.get('/api/pay-overview');
  expect(missing.status).toBe(400);
  expect(missing.body.fields).toEqual({ country: 'Choose a country.' });
});

test('a relocated person counts only in their current country', async () => {
  const { db, cells } = await setup([{ code: 'E000001', country: 'US', salary: 150000 }]);
  await db.query(`INSERT INTO job_changes (employee_id, effective_date, country, salary, currency) VALUES (1, '2025-01-01', 'DE', 95000, 'EUR')`);
  expect(await cells('US')).toEqual([]);
  expect(await cells('DE')).toEqual([{ department: 'Engineering', level: 3, median: 95000, min: 95000, max: 95000, headcount: 1 }]);
});
