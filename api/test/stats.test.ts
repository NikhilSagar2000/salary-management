import { expect, test } from 'vitest';
import { code, insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1]) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  const agent = await signIn(app);
  return { agent, db, stats: async (q = '') => (await agent.get(`/api/employees${q}`)).body.stats };
}

test('list summary gives median, min, max and headcount per currency for the whole filtered set', async () => {
  const salaries = [50000, 60000, 70000, 80000, 90000, 100000, 110000, 120000, 130000, 140000];
  const { stats } = await setup(salaries.map((salary, i) => ({ code: code(i + 1), country: 'US', salary })));
  expect(await stats('?pageSize=25')).toEqual([{ currency: 'USD', median: 95000, min: 50000, max: 140000, headcount: 10 }]);
  expect(await stats('?country=US&salaryMin=100000')).toEqual([{ currency: 'USD', median: 120000, min: 100000, max: 140000, headcount: 5 }]);
});

test('median is percentile_cont rounded half away from zero', async () => {
  const { stats } = await setup([
    { code: 'E000001', country: 'US', salary: 100000 },
    { code: 'E000002', country: 'US', salary: 100001 },
    { code: 'E000003', country: 'IN', salary: 2000000 },
    { code: 'E000004', country: 'IN', salary: 2000003 },
    { code: 'E000005', country: 'IN', salary: 9000000 },
  ]);
  const [usd] = await stats('?country=US');
  expect(usd.median).toBe(100001); // 100,000.5 rounds up, not to the even 100,000
  const [inr] = await stats('?country=IN');
  expect(inr.median).toBe(2000003); // odd count: the middle value
});

test('never combines currencies', async () => {
  const { stats } = await setup([
    { code: 'E000001', country: 'JP', salary: 6000000 },
    { code: 'E000002', country: 'IN', salary: 1500000 },
    { code: 'E000003', country: 'US', salary: 130000 },
    { code: 'E000004', country: 'US', salary: 150000 },
  ]);
  expect(await stats()).toEqual([
    { currency: 'USD', median: 140000, min: 130000, max: 150000, headcount: 2 },
    { currency: 'INR', median: 1500000, min: 1500000, max: 1500000, headcount: 1 },
    { currency: 'JPY', median: 6000000, min: 6000000, max: 6000000, headcount: 1 },
  ]);
});

test('counts active and leaving, not starting; left only when asked', async () => {
  const { stats, agent } = await setup([
    { code: 'E000001', country: 'US', salary: 100000 }, // active
    { code: 'E000002', country: 'US', salary: 200000, leaveDate: '2026-12-31' }, // leaving
    { code: 'E000003', country: 'US', salary: 900000, hireDate: '2026-12-01' }, // starting
    { code: 'E000004', country: 'US', salary: 10000, leaveDate: '2026-09-01' }, // left
  ]);
  expect(await stats()).toEqual([{ currency: 'USD', median: 150000, min: 100000, max: 200000, headcount: 2 }]);
  expect((await agent.get('/api/employees')).body.total).toBe(3); // the starting person is listed, just not counted
  expect(await stats('?status=active,leaving,left')).toEqual([{ currency: 'USD', median: 100000, min: 10000, max: 200000, headcount: 3 }]);
  expect(await stats('?status=starting')).toEqual([]);
});
