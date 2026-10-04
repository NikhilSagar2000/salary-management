import { expect, test } from 'vitest';
import { code, insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1]) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  return { agent: await signIn(app), db };
}

const lines = (text: string) => text.replace(/^﻿/, '').trimEnd().split('\r\n');

test('exports every filtered row with BOM, commas and the documented columns', async () => {
  const { agent } = await setup([
    ...Array.from({ length: 30 }, (_, i) => ({ code: code(i + 1), country: 'US', lastName: `Person${String(i + 1).padStart(2, '0')}` })),
    { code: 'E000099', country: 'IN', firstName: 'Priya', lastName: 'Sharma', salary: 1550000, leaveDate: '2026-12-31' },
  ]);
  const res = await agent.get('/api/employees.csv?country=US');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
  expect(res.headers['content-disposition']).toBe('attachment; filename="employees-2026-10-01.csv"');
  expect(res.text.startsWith('﻿')).toBe(true);
  const rows = lines(res.text);
  expect(rows[0]).toBe(
    'code,first_name,last_name,gender,work_email,country,department,role,level,salary,currency,hire_date,manager_code,status,leave_date,leave_reason',
  );
  expect(rows).toHaveLength(31); // header + all 30, not just a page
  const india = lines((await agent.get('/api/employees.csv?country=IN')).text);
  expect(india[1]).toBe('E000099,Priya,Sharma,female,e000099@acme.example,IN,Engineering,Software Engineer,3,1550000,INR,2020-01-01,,leaving,2026-12-31,');
});

test('prefixes formula-like cells with an apostrophe', async () => {
  const { agent, db } = await setup([{ code: 'E000001', firstName: '=HYPERLINK("x")', lastName: '+Plus' }]);
  await db.query("UPDATE employees SET leave_date = '2026-12-31', leave_reason = '@home -then'");
  const [, row] = lines((await agent.get('/api/employees.csv')).text);
  expect(row).toContain(`"'=HYPERLINK(""x"")",'+Plus,`);
  expect(row!.endsWith(",'@home -then")).toBe(true);
});

test('accented, apostrophe and comma names export intact', async () => {
  const { agent } = await setup([
    { code: 'E000001', firstName: 'Siobhan', lastName: "O'Brien", country: 'GB' },
    { code: 'E000002', firstName: 'Jörg', lastName: 'Müller-Lüdenscheidt', country: 'DE' },
    { code: 'E000003', firstName: 'John', lastName: 'Smith, Jr.', country: 'US' },
    { code: 'E000004', firstName: 'João', lastName: 'Gonçalves', country: 'BR' },
  ]);
  const rows = lines((await agent.get('/api/employees.csv?sort=code')).text);
  expect(rows[1]!.startsWith("E000001,Siobhan,O'Brien,")).toBe(true);
  expect(rows[2]!.startsWith('E000002,Jörg,Müller-Lüdenscheidt,')).toBe(true);
  expect(rows[3]!.startsWith('E000003,John,"Smith, Jr.",')).toBe(true);
  expect(rows[4]!.startsWith('E000004,João,Gonçalves,')).toBe(true);
});
