import { expect, test } from 'vitest';
import { insertPeople, signIn, testApp } from './helpers.ts';

async function setup(people: Parameters<typeof insertPeople>[1] = []) {
  const { app, db } = await testApp(); // today: 2026-10-01
  await insertPeople(db, people);
  const agent = await signIn(app);
  const send = (path: string, csv: string) => agent.post(path).set('Content-Type', 'text/csv').send(csv);
  return { db, preview: (csv: string) => send('/api/imports/preview', csv), commit: (csv: string) => send('/api/imports', csv) };
}

const HEADER = 'code,first_name,last_name,gender,work_email,country,department,role,level,salary,hire_date';
const row = (n: number, extra = '') =>
  `E${String(n).padStart(6, '0')},Ana${n},Silva,female,ana${n}@acme.example,BR,Engineering,Software Engineer,3,133000,2024-02-29${extra}`;

test('accepts comma or semicolon, BOM, any column order and header case', async () => {
  const { preview } = await setup();
  const comma = await preview([HEADER, row(1), row(2)].join('\n'));
  expect(comma.status).toBe(200);
  expect(comma.body.problems).toEqual([]);
  expect(comma.body.rows).toHaveLength(2);
  expect(comma.body.rows[0]).toEqual({
    line: 2, code: 'E000001', firstName: 'Ana1', lastName: 'Silva', gender: 'female', workEmail: 'ana1@acme.example',
    country: 'BR', currency: 'BRL', department: 'Engineering', role: 'Software Engineer', level: 3, salary: 133000,
    hireDate: '2024-02-29', managerCode: null,
  });
  const semicolon = await preview('﻿' + [HEADER.replaceAll(',', ';'), row(1).replaceAll(',', ';')].join('\r\n'));
  expect(semicolon.body.problems).toEqual([]);
  expect(semicolon.body.rows[0].code).toBe('E000001');
  const shuffled = await preview(['Salary,CODE,Hire_Date,first_name,last_name,gender,work_email,country,department,role,LEVEL',
    '95000,E000009,2025-01-15,Lee,Kim,male,lee.kim@acme.example,US,Engineering,QA Engineer,L2'].join('\n'));
  expect(shuffled.body.problems).toEqual([]);
  expect(shuffled.body.rows[0]).toMatchObject({ code: 'E000009', salary: 95000, level: 2, currency: 'USD', hireDate: '2025-01-15' });
});

test("allows the export's status and leave columns only when empty", async () => {
  const { preview } = await setup();
  const header = `${HEADER},currency,manager_code,status,leave_date,leave_reason`;
  const ok = await preview([header, row(1, ',BRL,,,,'), row(2, ',,,,,')].join('\n'));
  expect(ok.body.problems).toEqual([]);
  const bad = await preview([header, row(1, ',USD,,,,'), row(2, ',,,active,,'), row(3, ',,,,2026-12-31,Moving')].join('\n'));
  expect(bad.body.problems).toEqual([
    { line: 2, column: 'currency', message: 'Currency must be BRL for country BR.' },
    { line: 3, column: 'status', message: 'Leave this column empty: import only adds new employees.' },
    { line: 4, column: 'leave_date', message: 'Leave this column empty: import only adds new employees.' },
    { line: 4, column: 'leave_reason', message: 'Leave this column empty: import only adds new employees.' },
  ]);
});

test('refuses files over 5 MB or 10,000 rows', async () => {
  const { preview } = await setup();
  const big = await preview(`${HEADER}\n${'x'.repeat(5 * 1024 * 1024 + 1)}`);
  expect(big.status).toBe(413);
  expect(big.body).toEqual({ error: 'The file is larger than 5 MB. Split it into smaller files and import each one.' });
  const many = await preview([HEADER, ...Array.from({ length: 10_001 }, (_, i) => row(i + 1))].join('\n'));
  expect(many.status).toBe(200);
  expect(many.body.rows).toEqual([]);
  expect(many.body.problems).toEqual([
    { line: 0, column: '', message: 'The file has 10,001 rows; one import can take at most 10,000. Split it into smaller files.' },
  ]);
});

test.fails('quoted commas and line breaks, CRLF and trailing blank lines parse correctly', async () => {
  const { preview } = await setup();
  const csv = [
    HEADER,
    'E000001,"Ana, Maria",Silva,female,ana@acme.example,BR,Engineering,Software Engineer,3,133000,2024-02-29',
    'E000002,Bea,Costa,female,bea@acme.example,BR,Engineering,"Software\r\nEngineer",3,133000,2024-02-29', // lines 3–4
    'E000003,Caio,Lima,male,caio@acme.example,BR,Engineering,Software Engineer,3,"95,000",2024-02-29', // line 5
    '',
    '',
  ].join('\r\n');
  const res = await preview(csv);
  expect(res.body.rows.map((r: { code: string; firstName: string }) => [r.code, r.firstName])).toEqual([['E000001', 'Ana, Maria']]);
  expect(res.body.problems).toEqual([
    { line: 3, column: 'role', message: 'Choose a role.' },
    { line: 5, column: 'salary', message: 'Write the salary without separators, like 95000.' },
  ]);
});
