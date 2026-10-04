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

test('quoted commas and line breaks, CRLF and trailing blank lines parse correctly', async () => {
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

test('preview lists rows and every problem by line and column, saving nothing', async () => {
  const { preview, db } = await setup();
  const res = await preview([
    HEADER,
    row(1),
    'E000002,Bea,Costa,female,not-an-email,BR,Engineering,Software Engineer,9,133000,2024-02-29',
    'E000003,Caio,Lima,male,caio@acme.example,BR,Engineering,Software Engineer,3,133000,29/02/2024',
  ].join('\n'));
  expect(res.status).toBe(200);
  expect(res.body.rows.map((r: { line: number; code: string }) => [r.line, r.code])).toEqual([[2, 'E000001']]);
  expect(res.body.problems).toEqual([
    { line: 3, column: 'work_email', message: 'Enter a work email, like name@acme.example.' },
    { line: 3, column: 'level', message: 'Choose a level from L1 to L7.' },
    { line: 4, column: 'hire_date', message: 'Enter the hire date as YYYY-MM-DD.' },
  ]);
  expect((await db.query('SELECT count(*)::int AS n FROM employees')).rows[0].n).toBe(0);
});

test('applies the add-employee rules, ISO dates, manager from the database or the same file', async () => {
  const { preview } = await setup([{ code: 'E000500' }, { code: 'E000501', leaveDate: '2023-01-01' }]);
  const header = `${HEADER},manager_code`;
  const res = await preview([
    header,
    row(1, ',E000500'), // manager in the database
    row(2, ',E000001'), // manager earlier in this file, hired the same day
    row(3, ',E000999'),
    row(4, ',E000501'), // left before this hire date
    row(5, ',E000005'),
    row(6, ',E000007'), // manager later in this file, not hired yet on this date
    'E000007,Ana7,Silva,female,ana7@acme.example,BR,Engineering,Engineering Manager,5,285000,2025-01-01,',
  ].join('\n'));
  expect(res.body.problems).toEqual([
    { line: 4, column: 'manager_code', message: 'No employee with code E000999.' },
    { line: 5, column: 'manager_code', message: "Test E000501 isn't employed on 29 Feb 2024." },
    { line: 6, column: 'manager_code', message: "Someone can't be their own manager." },
    { line: 7, column: 'manager_code', message: "Ana7 Silva isn't employed on 29 Feb 2024." },
  ]);
  expect(res.body.rows.map((r: { code: string; managerCode: string | null }) => [r.code, r.managerCode])).toEqual([
    ['E000001', 'E000500'], ['E000002', 'E000001'], ['E000007', null],
  ]);
});

test('a duplicate code or email in the database or file flags every row involved', async () => {
  const { preview } = await setup([{ code: 'E000500', workEmail: 'taken@acme.example' }]);
  const res = await preview([
    HEADER,
    row(1),
    'E000500,Bea,Costa,female,bea@acme.example,BR,Engineering,Software Engineer,3,133000,2024-02-29', // code in the database
    'E000003,Caio,Lima,male,TAKEN@acme.example,BR,Engineering,Software Engineer,3,133000,2024-02-29', // email in the database
    row(1).replace('ana1@', 'ana-one@'), // same code as line 2
    'E000005,Davi,Rocha,male,ana1@acme.example,BR,Engineering,Software Engineer,3,133000,2024-02-29', // same email as line 2
  ].join('\n'));
  expect(res.body.problems).toEqual([
    { line: 2, column: 'code', message: 'E000001 appears more than once in the file (lines 2 and 5).' },
    { line: 2, column: 'work_email', message: 'ana1@acme.example appears more than once in the file (lines 2 and 6).' },
    { line: 3, column: 'code', message: 'E000500 is already used.' },
    { line: 4, column: 'work_email', message: 'That work email is already used.' },
    { line: 5, column: 'code', message: 'E000001 appears more than once in the file (lines 2 and 5).' },
    { line: 6, column: 'work_email', message: 'ana1@acme.example appears more than once in the file (lines 2 and 6).' },
  ]);
  expect(res.body.rows).toEqual([]);
});

test('import saves all rows in one transaction or none, re-checking at commit', async () => {
  const { commit, preview, db } = await setup([{ code: 'E000500' }]);
  const count = async () => (await db.query('SELECT count(*)::int AS n FROM employees')).rows[0].n;
  const header = `${HEADER},manager_code`;
  const good = [header, row(1, ',E000500'), row(2, ',E000001'), row(3, ',')].join('\n');

  const done = await commit(good);
  expect(done.status).toBe(201);
  expect(done.body).toEqual({ imported: 3 });
  expect(await count()).toBe(4);
  const { rows } = await db.query(
    `SELECT e.code, m.code AS manager, c.salary, c.currency, c.effective_date FROM employees e
     JOIN job_changes c ON c.employee_id = e.id LEFT JOIN employees m ON m.id = c.manager_id WHERE e.code LIKE 'E00000%' ORDER BY e.code`,
  );
  expect(rows).toEqual([
    { code: 'E000001', manager: 'E000500', salary: 133000, currency: 'BRL', effective_date: '2024-02-29' },
    { code: 'E000002', manager: 'E000001', salary: 133000, currency: 'BRL', effective_date: '2024-02-29' },
    { code: 'E000003', manager: null, salary: 133000, currency: 'BRL', effective_date: '2024-02-29' },
  ]);

  const mixed = await commit([HEADER, row(4), row(5).replace(',133000,', ',abc,')].join('\n'));
  expect(mixed.status).toBe(400);
  expect(mixed.body.error).toBe('Nothing was imported. Fix these problems and try again.');
  expect(mixed.body.problems).toEqual([{ line: 3, column: 'salary', message: 'Enter the salary as a whole number, like 95000.' }]);
  expect(await count()).toBe(4);

  // Previewed fine, but the code was taken before "Import" was pressed.
  const later = [HEADER, row(6), row(7)].join('\n');
  expect((await preview(later)).body.problems).toEqual([]);
  await db.query("INSERT INTO employees (code, first_name, last_name, gender, work_email, hire_date) VALUES ('E000007', 'X', 'Y', 'male', 'x@acme.example', '2020-01-01')");
  const raced = await commit(later);
  expect(raced.status).toBe(400);
  expect(raced.body.problems).toEqual([{ line: 3, column: 'code', message: 'E000007 is already used.' }]);
  expect(await count()).toBe(5);
});

test.fails('reports an empty file, missing columns or an unreadable file plainly', async () => {
  const { preview } = await setup();
  const fileProblem = async (csv: string) => {
    const res = await preview(csv);
    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
    return res.body.problems;
  };
  const whole = (message: string) => [{ line: 0, column: '', message }];
  expect(await fileProblem('')).toEqual(whole('The file is empty.'));
  expect(await fileProblem(`${HEADER}\n`)).toEqual(whole('The file has a header row but no employees under it.'));
  expect(await fileProblem('code,first_name\nE000001,Ana')).toEqual(
    whole('The file is missing these columns: last_name, gender, work_email, country, department, role, level, salary, hire_date.'),
  );
  expect(await fileProblem(`${HEADER},bonus\n${row(1, ',5000')}`)).toEqual(whole("The file has columns the app doesn't use: bonus."));
  expect(await fileProblem(`${HEADER}\nE000001,"Ana,Silva,female`)).toEqual(
    whole("The file couldn't be read: a quote opened on line 2 is never closed."),
  );
  expect(await fileProblem('PK\u0003\u0004\u0014\u0000binary')).toEqual(
    whole('This looks like an Excel workbook, not a CSV file. In Excel choose File › Save As › CSV UTF-8, then import that file.'),
  );
});
