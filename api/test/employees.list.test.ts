import { expect, test } from 'vitest';
import { code, insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1] = []) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  const agent = await signIn(app);
  return { agent, db, list: (query = '') => agent.get(`/api/employees${query}`) };
}

test.fails('returns a page of 25 with the total; 50 and 100 allowed', async () => {
  const { list } = await setup(Array.from({ length: 60 }, (_, i) => ({ code: code(i + 1), lastName: `Person${String(i + 1).padStart(2, '0')}` })));
  const first = await list();
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ total: 60, page: 1, pageSize: 25 });
  expect(first.body.rows).toHaveLength(25);
  expect(first.body.rows[0].code).toBe('E000001');
  const third = await list('?page=3');
  expect(third.body.rows.map((r: { code: string }) => r.code)).toEqual(Array.from({ length: 10 }, (_, i) => code(51 + i)));
  expect((await list('?pageSize=50')).body.rows).toHaveLength(50);
  expect((await list('?pageSize=100')).body.rows).toHaveLength(60);
});
