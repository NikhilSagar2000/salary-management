import { expect, test } from 'vitest';
import { runTool } from '../src/assistant/tools.ts';
import { code, insertPeople, testApp } from './helpers.ts';

const TODAY = '2026-10-01';

async function setup(people: Parameters<typeof insertPeople>[1]) {
  const { db } = await testApp();
  await insertPeople(db, people);
  return { db, tool: (name: string, args: unknown) => runTool(db, TODAY, name, args) };
}

test('query_employees filters any field, caps at 200 rows and reports the total', async () => {
  const { tool } = await setup([
    ...Array.from({ length: 230 }, (_, i) => ({ code: code(i + 1), country: 'US', salary: 100000 + i })),
    { code: 'E000901', firstName: 'Priya', lastName: 'Sharma', country: 'IN', gender: 'female', level: 4, salary: 2500000, hireDate: '2019-05-01' },
    { code: 'E000902', firstName: 'Ravi', lastName: 'Kumar', country: 'IN', gender: 'male', level: 4, salary: 2400000, leaveDate: '2026-05-31' },
  ]);
  const all = await tool('query_employees', { filters: { country: ['US'] }, limit: 500 });
  expect(all.result).toMatchObject({ total: 230 });
  expect((all.result as { rows: unknown[] }).rows).toHaveLength(200);

  const india = await tool('query_employees', { filters: { country: ['IN'], level: [4], status: ['active', 'left'] }, sort: 'salary', direction: 'desc' });
  expect(india.result).toEqual({
    total: 2,
    rows: [
      { code: 'E000901', name: 'Priya Sharma', gender: 'female', country: 'IN', currency: 'INR', department: 'Engineering', role: 'Software Engineer',
        level: 4, salary: 2500000, hireDate: '2019-05-01', leaveDate: null, status: 'active', managerCode: null },
      { code: 'E000902', name: 'Ravi Kumar', gender: 'male', country: 'IN', currency: 'INR', department: 'Engineering', role: 'Software Engineer',
        level: 4, salary: 2400000, hireDate: '2020-01-01', leaveDate: '2026-05-31', status: 'left', managerCode: null },
    ],
  });
  expect(india.sources).toEqual([
    { kind: 'group', label: 'India · Level 4 · active or left', query: 'country=IN&level=4&status=active,left', headcount: 2 },
    { kind: 'person', code: 'E000901', name: 'Priya Sharma' },
    { kind: 'person', code: 'E000902', name: 'Ravi Kumar' },
  ]);
  const hired = await tool('query_employees', { filters: { hiredFrom: '2019-01-01', hiredTo: '2019-12-31', search: 'priya' } });
  expect((hired.result as { rows: { code: string }[] }).rows.map((r) => r.code)).toEqual(['E000901']);
});

test('get_employee returns the full history', async () => {
  const { tool, db } = await setup([{ code: 'E000001', firstName: 'Ana', lastName: 'Silva', country: 'BR', salary: 133000, hireDate: '2024-02-29' }]);
  await db.query(`INSERT INTO job_changes (employee_id, effective_date, level, salary, currency, note) VALUES (1, '2025-04-01', 4, 150000, 'BRL', 'Promotion to L4')`);
  const { result, sources } = await tool('get_employee', { code: 'E000001' });
  expect(result).toMatchObject({
    code: 'E000001', firstName: 'Ana', lastName: 'Silva', status: 'active',
    current: { country: 'BR', level: 4, salary: 150000, currency: 'BRL' },
    timeline: [
      { type: 'change', date: '2024-02-29', hire: true },
      { type: 'change', date: '2025-04-01', note: 'Promotion to L4', changes: [
        { field: 'level', from: 3, to: 4 }, { field: 'salary', from: { amount: 133000, currency: 'BRL' }, to: { amount: 150000, currency: 'BRL' } },
      ] },
    ],
  });
  expect(sources).toEqual([{ kind: 'person', code: 'E000001', name: 'Ana Silva' }]);
  expect((await tool('get_employee', { code: 'E000999' })).result).toEqual({ error: 'No employee with code E000999.' });
});

test.fails('query_changes classifies kinds and caps at 200', async () => {
  const { tool, db } = await setup([
    { code: 'E000001', firstName: 'Ana', lastName: 'Silva', country: 'BR', salary: 100000, hireDate: '2020-01-01' },
    { code: 'E000002', firstName: 'Bo', lastName: 'Lee', country: 'US', salary: 120000, hireDate: '2020-01-01' },
    ...Array.from({ length: 230 }, (_, i) => ({ code: code(i + 10), country: 'US', salary: 90000, hireDate: '2021-01-01' })),
  ]);
  const add = (sql: string) => db.query(`INSERT INTO job_changes (employee_id, effective_date, level, country, role, salary, currency, manager_set, manager_id) VALUES ${sql}`);
  await add(`(1, '2025-04-01', NULL, NULL, NULL, 110000, 'BRL', false, NULL)`); // raise 10%
  await add(`(1, '2025-09-01', 4, NULL, NULL, 125000, 'BRL', false, NULL)`); // promotion with raise
  await add(`(1, '2026-02-01', NULL, 'DE', NULL, 70000, 'EUR', false, NULL)`); // relocation
  await add(`(2, '2025-05-01', NULL, NULL, NULL, 115000, 'USD', true, 1)`); // pay cut + new manager
  await db.query(`INSERT INTO job_changes (employee_id, effective_date, salary, currency) SELECT id, '2025-04-01', 99000, 'USD' FROM employees WHERE id > 2`);
  await db.query(`UPDATE employees SET leave_date = '2026-06-30' WHERE id = 2`);
  await db.query(`INSERT INTO leave_events (employee_id, kind, leave_date, reason) VALUES (2, 'left', '2026-06-30', 'Resigned')`);

  const ana = await tool('query_changes', { filters: { codes: ['E000001', 'E000002'], status: ['active', 'left'] }, from: '2025-01-01' });
  expect((ana.result as { rows: unknown[] }).rows).toEqual([
    { code: 'E000002', name: 'Bo Lee', date: '2026-06-30', kinds: ['leave'], changes: [], note: 'Resigned' },
    { code: 'E000001', name: 'Ana Silva', date: '2026-02-01', kinds: ['relocation'], note: null, changes: [
      { field: 'country', from: 'BR', to: 'DE' }, { field: 'salary', from: { amount: 125000, currency: 'BRL' }, to: { amount: 70000, currency: 'EUR' } }] },
    { code: 'E000001', name: 'Ana Silva', date: '2025-09-01', kinds: ['promotion', 'raise'], note: null, raisePct: 13.6, changes: [
      { field: 'level', from: 3, to: 4 }, { field: 'salary', from: { amount: 110000, currency: 'BRL' }, to: { amount: 125000, currency: 'BRL' } }] },
    { code: 'E000002', name: 'Bo Lee', date: '2025-05-01', kinds: ['pay_cut', 'manager_change'], note: null, raisePct: -4.2, changes: [
      { field: 'manager', from: null, to: { code: 'E000001', name: 'Ana Silva' } },
      { field: 'salary', from: { amount: 120000, currency: 'USD' }, to: { amount: 115000, currency: 'USD' } }] },
    { code: 'E000001', name: 'Ana Silva', date: '2025-04-01', kinds: ['raise'], note: null, raisePct: 10, changes: [
      { field: 'salary', from: { amount: 100000, currency: 'BRL' }, to: { amount: 110000, currency: 'BRL' } }] },
  ]);
  const raises = await tool('query_changes', { kinds: ['raise'], from: '2025-04-01', to: '2025-04-01', limit: 500 });
  expect(raises.result).toMatchObject({ total: 231 });
  expect((raises.result as { rows: unknown[] }).rows).toHaveLength(200);
  expect(raises.sources[0]).toEqual({ kind: 'group', label: 'Everyone · raise · 2025-04-01 to 2025-04-01', query: '', headcount: 231 });
});
