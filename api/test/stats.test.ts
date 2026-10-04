import { expect, test } from 'vitest';
import { code, insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1]) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  const agent = await signIn(app);
  return { agent, db, stats: async (q = '') => (await agent.get(`/api/employees${q}`)).body.stats };
}

test.fails('list summary gives median, min, max and headcount per currency for the whole filtered set', async () => {
  const salaries = [50000, 60000, 70000, 80000, 90000, 100000, 110000, 120000, 130000, 140000];
  const { stats } = await setup(salaries.map((salary, i) => ({ code: code(i + 1), country: 'US', salary })));
  expect(await stats('?pageSize=25')).toEqual([{ currency: 'USD', median: 95000, min: 50000, max: 140000, headcount: 10 }]);
  expect(await stats('?country=US&salaryMin=100000')).toEqual([{ currency: 'USD', median: 120000, min: 100000, max: 140000, headcount: 5 }]);
});
