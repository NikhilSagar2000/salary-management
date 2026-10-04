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

test('filters combine with AND across fields and OR within one', async () => {
  const { list } = await setup([
    { code: 'E000001', country: 'US', department: 'Engineering', level: 3, gender: 'female' },
    { code: 'E000002', country: 'US', department: 'Sales', role: 'Account Executive', level: 3, gender: 'male' },
    { code: 'E000003', country: 'IN', department: 'Engineering', level: 4, gender: 'female' },
    { code: 'E000004', country: 'GB', department: 'Engineering', level: 3, gender: 'non_binary' },
  ]);
  const sorted = async (q: string) => codes(await list(q)).sort();
  expect(await sorted('?country=US,IN')).toEqual(['E000001', 'E000002', 'E000003']);
  expect(await sorted('?country=US&department=Engineering')).toEqual(['E000001']);
  expect(await sorted('?level=3,4&gender=female')).toEqual(['E000001', 'E000003']);
  expect(await sorted('?role=Account%20Executive')).toEqual(['E000002']);
  expect(await sorted('?gender=non_binary&country=GB,US')).toEqual(['E000004']);
});

test('default status filter hides people who have left', async () => {
  const { list } = await setup([
    { code: 'E000001' }, // active
    { code: 'E000002', hireDate: '2026-12-01' }, // starting
    { code: 'E000003', leaveDate: '2026-12-31' }, // leaving
    { code: 'E000004', leaveDate: '2026-09-15' }, // left
  ]);
  const sorted = async (q: string) => codes(await list(q)).sort();
  expect(await sorted('')).toEqual(['E000001', 'E000002', 'E000003']);
  expect(await sorted('?status=left')).toEqual(['E000004']);
  expect(await sorted('?status=active,left')).toEqual(['E000001', 'E000004']);
  expect(await sorted('?status=starting')).toEqual(['E000002']);
});

test('sorts by each column both ways, ties broken by code', async () => {
  const { list } = await setup([
    { code: 'E000001', lastName: 'Costa', country: 'BR', department: 'Sales', role: 'Account Executive', level: 2, hireDate: '2021-05-01' },
    { code: 'E000002', lastName: 'Abe', country: 'JP', department: 'Engineering', level: 5, hireDate: '2019-01-01' },
    { code: 'E000003', lastName: 'Costa', country: 'US', department: 'Engineering', level: 3, hireDate: '2021-05-01' },
  ]);
  const order = async (sort: string, dir: string) => codes(await list(`?sort=${sort}&dir=${dir}`)).map((c) => Number(c.slice(-1)));
  expect(await order('name', 'asc')).toEqual([2, 1, 3]);
  expect(await order('name', 'desc')).toEqual([1, 3, 2]);
  expect(await order('code', 'desc')).toEqual([3, 2, 1]);
  expect(await order('country', 'asc')).toEqual([1, 2, 3]);
  expect(await order('country', 'desc')).toEqual([3, 2, 1]);
  expect(await order('department', 'asc')).toEqual([2, 3, 1]);
  expect(await order('role', 'desc')).toEqual([2, 3, 1]);
  expect(await order('level', 'desc')).toEqual([2, 3, 1]);
  expect(await order('hireDate', 'asc')).toEqual([2, 1, 3]);
  expect(await order('hireDate', 'desc')).toEqual([1, 3, 2]);
});

test('salary sort and range need exactly one country', async () => {
  const { list } = await setup([
    { code: 'E000001', country: 'US', salary: 90000 },
    { code: 'E000002', country: 'US', salary: 150000 },
    { code: 'E000003', country: 'US', salary: 120000 },
    { code: 'E000004', country: 'IN', salary: 2500000 },
  ]);
  const ONE_COUNTRY = 'Choose one country to sort or filter by salary, because salaries are in different currencies.';
  for (const q of ['?sort=salary', '?country=US,IN&sort=salary', '?salaryMin=100000', '?country=US,IN&salaryMax=200000']) {
    const res = await list(q);
    expect(res.status, q).toBe(400);
    expect(res.body.fields, q).toEqual({ country: ONE_COUNTRY });
  }
  expect(codes(await list('?country=US&sort=salary&dir=desc'))).toEqual(['E000002', 'E000003', 'E000001']);
  expect(codes(await list('?country=US&salaryMin=100000&salaryMax=150000&sort=salary'))).toEqual(['E000003', 'E000002']);
});

test('rejects invalid query values naming the value', async () => {
  const { list } = await setup();
  const cases: [string, Record<string, string>][] = [
    ['?pageSize=1000', { pageSize: 'Page size must be 25, 50 or 100, not "1000".' }],
    ['?page=0', { page: 'Page must be a whole number from 1, not "0".' }],
    ['?page=abc', { page: 'Page must be a whole number from 1, not "abc".' }],
    ['?country=US,XX', { country: 'There\'s no country called "XX".' }],
    ['?level=9', { level: 'There\'s no level called "9".' }],
    ['?sort=age', { sort: 'There\'s no sort called "age".' }],
    ['?country=US&salaryMin=lots', { salaryMin: 'Enter the salary as a whole number, like 95000.' }],
  ];
  for (const [q, fields] of cases) {
    const res = await list(q);
    expect(res.status, q).toBe(400);
    expect(res.body, q).toEqual({ error: 'Some fields need fixing.', fields });
  }
});
