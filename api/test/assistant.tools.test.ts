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
