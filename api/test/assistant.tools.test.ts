import { expect, test } from 'vitest';
import { runTool, TOOLS } from '../src/assistant/tools.ts';
import { readOnlyTx } from '../src/db.ts';
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

test('query_changes classifies kinds and caps at 200', async () => {
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
  expect(raises.sources[0]).toEqual({ kind: 'group', label: 'Everyone · raise · 2025-04-01 to 2025-04-01', query: null, headcount: 231 });
});

test('aggregate computes exact stats split by currency', async () => {
  const { tool, db } = await setup([
    { code: 'E000001', country: 'US', level: 3, salary: 100000, gender: 'female' },
    { code: 'E000002', country: 'US', level: 3, salary: 120000, gender: 'male' },
    { code: 'E000003', country: 'US', level: 4, salary: 150000, gender: 'female', hireDate: '2026-03-01' },
    { code: 'E000004', country: 'IN', level: 3, salary: 1500000, gender: 'male' },
    { code: 'E000005', country: 'IN', level: 3, salary: 1700000, gender: 'female' },
    { code: 'E000006', country: 'US', level: 3, salary: 999999, leaveDate: '2025-12-31' }, // left: not counted
  ]);
  const salary = await tool('aggregate', { metric: 'salary', groupBy: ['country', 'level'] });
  expect(salary.result).toEqual({
    groups: [
      { country: 'US', level: 3, currency: 'USD', median: 110000, min: 100000, max: 120000, headcount: 2 },
      { country: 'US', level: 4, currency: 'USD', median: 150000, min: 150000, max: 150000, headcount: 1 },
      { country: 'IN', level: 3, currency: 'INR', median: 1600000, min: 1500000, max: 1700000, headcount: 2 },
    ],
  });
  expect(salary.sources[0]).toEqual({ kind: 'group', label: 'United States · Level 3', query: 'country=US&level=3', headcount: 2 });

  const mixed = await tool('aggregate', { metric: 'salary', groupBy: ['gender'] });
  expect(mixed.result).toEqual({
    groups: [
      { gender: 'female', currency: 'USD', median: 125000, min: 100000, max: 150000, headcount: 2 },
      { gender: 'male', currency: 'USD', median: 120000, min: 120000, max: 120000, headcount: 1 },
      { gender: 'female', currency: 'INR', median: 1700000, min: 1700000, max: 1700000, headcount: 1 },
      { gender: 'male', currency: 'INR', median: 1500000, min: 1500000, max: 1500000, headcount: 1 },
    ],
  });
  const before = await tool('aggregate', { metric: 'headcount', groupBy: ['country'], asOf: '2026-01-01' });
  expect(before.result).toEqual({ groups: [{ country: 'US', headcount: 2 }, { country: 'IN', headcount: 2 }] });

  await db.query(`INSERT INTO job_changes (employee_id, effective_date, salary, currency) VALUES (1, '2025-04-01', 110000, 'USD'), (2, '2025-04-01', 126000, 'USD'), (4, '2025-04-01', 1650000, 'INR')`);
  const raises = await tool('aggregate', { metric: 'raise_pct', groupBy: ['country'], from: '2025-01-01', to: '2025-12-31' });
  expect(raises.result).toEqual({
    groups: [{ country: 'US', median: 7.5, min: 5, max: 10, count: 2 }, { country: 'IN', median: 10, min: 10, max: 10, count: 1 }],
  });
});

test('bad arguments and unknown tools return an error result', async () => {
  const { tool } = await setup([]);
  expect(await tool('drop_table', {})).toEqual({ result: { error: 'There is no tool called "drop_table".' }, sources: [] });
  const badCountry = await tool('query_employees', { filters: { country: ['XX'] } });
  expect(badCountry.sources).toEqual([]);
  expect((badCountry.result as { error: string }).error).toMatch(/filters\.country/);
  expect(((await tool('aggregate', 'not an object')).result as { error: string }).error).toBeTypeOf('string');
  expect(((await tool('get_employee', { code: 'E1; DROP TABLE employees' })).result as { error: string }).error).toMatch(/code/);
  expect(((await tool('query_employees', { filters: { sql: 'SELECT 1' } })).result as { error: string }).error).toMatch(/sql/);
});

test('tool queries run in a read-only transaction', async () => {
  const { db } = await setup([{ code: 'E000001' }]);
  await expect(readOnlyTx(db, (tx) => tx.query("INSERT INTO sessions VALUES ('x', now())"))).rejects.toThrow(/read-only transaction/);

  // Every statement a tool sends goes through one client that began a read-only transaction.
  const seen: string[] = [];
  const spy = Object.create(db) as typeof db;
  spy.query = (async (...a: Parameters<typeof db.query>) => { seen.push(`pool: ${String(a[0])}`); return db.query(...a); }) as typeof db.query;
  spy.connect = (async () => {
    const client = await db.connect();
    const query = client.query.bind(client);
    client.query = ((...a: Parameters<typeof client.query>) => { seen.push(`client: ${String(a[0]).slice(0, 20)}`); return query(...a); }) as typeof client.query;
    return client;
  }) as typeof db.connect;
  await runTool(spy, TODAY, 'query_employees', {});
  expect(seen[0]).toBe('client: BEGIN READ ONLY');
  expect(seen.some((s) => s.startsWith('pool:'))).toBe(false);
});

test('no tool parameter accepts SQL or free-form expressions', () => {
  expect(TOOLS.map((t) => t.function.name).sort()).toEqual(['aggregate', 'get_employee', 'query_changes', 'query_employees']);
  const loose: string[] = [];
  const walk = (schema: Record<string, unknown>, path: string) => {
    if (schema.type === 'object') {
      if (schema.additionalProperties !== false) loose.push(`${path} allows unknown keys`);
      for (const [k, v] of Object.entries((schema.properties ?? {}) as Record<string, Record<string, unknown>>)) walk(v, `${path}.${k}`);
    }
    if (schema.type === 'array') walk(schema.items as Record<string, unknown>, `${path}[]`);
    if (schema.type === 'string' && !schema.enum && !schema.pattern) {
      // The only free text: a search phrase, used as a literal LIKE value (wildcards escaped), length-limited.
      if (!(path.endsWith('.search') && (schema.maxLength as number) <= 100)) loose.push(`${path} is free text`);
    }
  };
  for (const t of TOOLS) {
    expect(t.function.description.length).toBeGreaterThan(40);
    walk(t.function.parameters as Record<string, unknown>, t.function.name);
  }
  expect(loose).toEqual([]);
});

test('a group links to the list only when the list can show exactly those people (AST-8)', async () => {
  const { tool } = await setup([
    { code: 'E000001', country: 'US', level: 3, hireDate: '2025-03-01' },
    { code: 'E000002', country: 'US', level: 3, hireDate: '2024-03-01' },
  ]);
  const query = async (name: string, args: unknown) => (await tool(name, args)).sources.filter((s) => s.kind === 'group').map((s) => s.query);
  expect(await query('query_employees', { filters: { country: ['US'] } })).toEqual(['country=US']);
  expect(await query('aggregate', { metric: 'salary', groupBy: ['level'], filters: { country: ['US'] } })).toEqual(['country=US&level=3']);
  // The list has no hire-date, leave-date, manager or named-people filter, no past dates and no change history:
  expect(await query('query_employees', { filters: { country: ['US'], hiredFrom: '2025-01-01' } })).toEqual([null]);
  expect(await query('query_employees', { filters: { codes: ['E000001'] } })).toEqual([null]);
  expect(await query('query_employees', { filters: { managerCode: 'E000002' } })).toEqual([null]);
  expect(await query('aggregate', { metric: 'headcount', groupBy: ['hire_year'], filters: { country: ['US'] } })).toEqual([null, null]);
  expect(await query('aggregate', { metric: 'salary', filters: { country: ['US'] }, asOf: '2025-06-01' })).toEqual([null]);
  expect(await query('query_changes', { filters: { country: ['US'] } })).toEqual([null]);
});
