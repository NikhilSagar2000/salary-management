import { expect, test } from 'vitest';
import { code, insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1] = []) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  const agent = await signIn(app);
  return { agent, db, list: (query = '') => agent.get(`/api/employees${query}`) };
}

test('returns a page of 25 with the total; 50 and 100 allowed', async () => {
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

const codes = (res: { body: { rows: { code: string }[] } }) => res.body.rows.map((r) => r.code);

test('search matches part of name, email or code ignoring case and accents', async () => {
  const { list } = await setup([
    { code: 'E000001', firstName: 'Lena', lastName: 'Müller', country: 'DE' },
    { code: 'E000002', firstName: 'José', lastName: 'Álvarez', workEmail: 'jose.alvarez@acme.example', country: 'BR' },
    { code: 'E000003', firstName: 'Priya', lastName: 'Sharma', country: 'IN' },
  ]);
  expect(codes(await list('?q=muller'))).toEqual(['E000001']);
  expect(codes(await list('?q=MÜLLER'))).toEqual(['E000001']);
  expect(codes(await list('?q=jose'))).toEqual(['E000002']);
  expect(codes(await list('?q=varez%40acme'))).toEqual(['E000002']);
  expect(codes(await list('?q=000003'))).toEqual(['E000003']);
  expect(codes(await list('?q=priya%20shar'))).toEqual(['E000003']);
  expect(codes(await list('?q=%20%20'))).toHaveLength(3); // blank search = no search
});

test('names with apostrophes and hyphens are found', async () => {
  const { list } = await setup([
    { code: 'E000001', firstName: 'Siobhan', lastName: "O'Brien", country: 'GB' },
    { code: 'E000002', firstName: 'Jörg', lastName: 'Müller-Lüdenscheidt', country: 'DE' },
    { code: 'E000003', firstName: 'Ana_Maria', lastName: 'Costa', country: 'BR' },
  ]);
  expect(codes(await list(`?q=${encodeURIComponent("o'brien")}`))).toEqual(['E000001']);
  expect(codes(await list('?q=muller-lud'))).toEqual(['E000002']);
  expect(codes(await list('?q=%25'))).toEqual([]); // a typed % is literal, not "anything"
  expect(codes(await list('?q=_'))).toEqual(['E000003']);
});
