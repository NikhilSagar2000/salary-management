// The pay assistant's tools (AST-4, AST-5): read-only, typed arguments, no SQL from the model.
import { COUNTRIES, COUNTRY_NAMES, CURRENCY, DEPARTMENTS, formatMoney, GENDERS, MSG, ROLE_NAMES, SORTS, STATUSES, type Country } from '@acme/shared';
import type pg from 'pg';
import { readOnlyTx, type Db } from '../db.ts';
import { z } from 'zod';
import { employeeDetail } from '../employees/detail.ts';
import { listFilter, STATUS_SQL, type Filters } from '../employees/list.ts';
import { CURRENCY_ORDER, PAY_STATS } from '../stats/peers.ts';

export type Source = { kind: 'group'; label: string; query: string; headcount: number } | { kind: 'person'; code: string; name: string };
type ToolResult = { result: unknown; sources: Source[] };

const MAX_ROWS = 200;
const PEOPLE_IN_SOURCES = 20;
const code = z.string().regex(/^E\d{6}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const filtersSchema = z
  .object({
    search: z.string().max(100).optional().describe('Part of a full name, work email or employee code'),
    codes: z.array(code).max(MAX_ROWS).optional().describe('Exact employee codes'),
    country: z.array(z.enum(COUNTRIES)).optional(),
    department: z.array(z.enum(DEPARTMENTS)).optional(),
    role: z.array(z.enum(ROLE_NAMES)).optional(),
    level: z.array(z.number().int().min(1).max(7)).optional(),
    gender: z.array(z.enum(GENDERS)).optional(),
    status: z.array(z.enum(STATUSES)).optional().describe('Default: starting, active and leaving (people who have left are excluded)'),
    hiredFrom: date.optional(),
    hiredTo: date.optional(),
    leftFrom: date.optional(),
    leftTo: date.optional(),
    salaryMin: z.number().int().positive().optional().describe('Needs exactly one country, because currencies differ'),
    salaryMax: z.number().int().positive().optional().describe('Needs exactly one country, because currencies differ'),
    managerCode: code.optional().describe("Only the manager's direct reports"),
  })
  .strict();
type ToolFilters = z.infer<typeof filtersSchema>;

const queryEmployeesSchema = z
  .object({
    filters: filtersSchema.default({}),
    sort: z.enum(SORTS).default('name'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    limit: z.number().int().min(1).default(50).describe(`At most ${MAX_ROWS} rows are returned`),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

// Tool filters are a superset of the list's, validated by the same enums; levels are checked 1–7 above.
const toFilters = (f: ToolFilters, sort?: Filters['sort'], dir?: Filters['dir']) => ({ ...f, q: f.search, sort, dir }) as Filters;

/** "India · Level 4 · active or left": the filters in words, for the "Based on" panel. */
export function describeFilters(f: ToolFilters): string {
  const or = (xs: (string | number)[]) => xs.join(' or ');
  const parts = [
    f.search && `matching "${f.search}"`,
    f.codes && `${f.codes.length} named people`,
    f.country && or(f.country.map((c) => COUNTRY_NAMES[c])),
    f.department && or(f.department),
    f.role && or(f.role),
    f.level && `${f.level.length > 1 ? 'Levels' : 'Level'} ${f.level.join(', ')}`,
    f.gender && or(f.gender.map((g) => g.replace('_', '-'))),
    f.status && or(f.status),
    (f.hiredFrom || f.hiredTo) && `hired ${f.hiredFrom ?? '…'} to ${f.hiredTo ?? '…'}`,
    (f.leftFrom || f.leftTo) && `left ${f.leftFrom ?? '…'} to ${f.leftTo ?? '…'}`,
    (f.salaryMin || f.salaryMax) && f.country?.length === 1 &&
      `salary ${f.salaryMin ? formatMoney(f.salaryMin, CURRENCY[f.country[0]!]) : '…'} to ${f.salaryMax ? formatMoney(f.salaryMax, CURRENCY[f.country[0]!]) : '…'}`,
    f.managerCode && `reporting to ${f.managerCode}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Everyone';
}

/** The employee-list URL query for the filters the list supports. */
export function listQueryOf(f: ToolFilters): string {
  const pairs: [string, unknown[] | string | number | undefined][] = [
    ['q', f.search], ['country', f.country], ['department', f.department], ['role', f.role], ['level', f.level],
    ['gender', f.gender], ['status', f.status], ['salaryMin', f.salaryMin], ['salaryMax', f.salaryMax],
  ];
  return pairs
    .filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.map((x) => encodeURIComponent(String(x))).join(',') : encodeURIComponent(String(v))}`)
    .join('&');
}

const salaryNeedsOneCountry = (f: ToolFilters) => (f.salaryMin !== undefined || f.salaryMax !== undefined) && f.country?.length !== 1;

async function queryEmployees(db: Db, today: string, args: z.infer<typeof queryEmployeesSchema>): Promise<ToolResult> {
  const f = args.filters;
  if (salaryNeedsOneCountry(f) || (args.sort === 'salary' && f.country?.length !== 1)) {
    return { result: { error: 'Salary filters and salary sorting need exactly one country, because salaries are in different currencies.' }, sources: [] };
  }
  const { params, fromWhere, orderBy } = listFilter(toFilters(f, args.sort, args.direction), today);
  const from = fromWhere([], 'LEFT JOIN employees m ON m.id = s.manager_id');
  const total = (await db.query(`SELECT count(*) AS n ${from}`, params)).rows[0].n as number;
  const { rows } = await db.query(
    `SELECT e.code, e.first_name || ' ' || e.last_name AS name, e.gender, s.country, s.currency, s.department, s.role, s.level, s.salary,
       e.hire_date AS "hireDate", e.leave_date AS "leaveDate", ${STATUS_SQL} AS status, m.code AS "managerCode"
     ${from} ORDER BY ${orderBy} LIMIT ${Math.min(args.limit, MAX_ROWS)} OFFSET ${args.offset}`,
    params,
  );
  return {
    result: { total, rows },
    sources: [
      { kind: 'group', label: describeFilters(f), query: listQueryOf(f), headcount: total },
      ...rows.slice(0, PEOPLE_IN_SOURCES).map((r) => ({ kind: 'person' as const, code: r.code, name: r.name })),
    ],
  };
}

const getEmployeeSchema = z.object({ code }).strict();

async function getEmployee(db: Db, today: string, args: z.infer<typeof getEmployeeSchema>): Promise<ToolResult> {
  const detail = await employeeDetail(db, args.code, today);
  if (!detail) return { result: { error: MSG.noEmployee(args.code) }, sources: [] };
  return { result: detail, sources: [{ kind: 'person', code: detail.code, name: `${detail.firstName} ${detail.lastName}` }] };
}

const CHANGE_KINDS = [
  'hire', 'promotion', 'demotion', 'raise', 'pay_cut', 'role_change', 'department_change', 'relocation', 'manager_change',
  'leave', 'undo_leave',
] as const;

const queryChangesSchema = z
  .object({
    filters: filtersSchema.default({}).describe("Which people (by their current job); default: everyone who hasn't left"),
    kinds: z.array(z.enum(CHANGE_KINDS)).optional().describe('Only changes of these kinds'),
    from: date.optional().describe('Changes on or after this date'),
    to: date.optional().describe('Changes on or before this date'),
    limit: z.number().int().min(1).default(50).describe(`At most ${MAX_ROWS} rows are returned`),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

type Money = { amount: number; currency: string };
const FIELDS = ['country', 'department', 'role', 'level'] as const;

async function queryChanges(db: Db, today: string, args: z.infer<typeof queryChangesSchema>): Promise<ToolResult> {
  const f = args.filters;
  if (salaryNeedsOneCountry(f)) return { result: { error: 'Salary filters need exactly one country.' }, sources: [] };
  const { params, fromWhere } = listFilter(toFilters(f), today);
  const where = [`l.employee_id IN (SELECT e.id ${fromWhere()})`];
  const param = (v: unknown) => `$${params.push(v)}`;
  if (args.kinds) where.push(`l.kinds && ${param(args.kinds)}::text[]`);
  if (args.from) where.push(`l.date >= ${param(args.from)}`);
  if (args.to) where.push(`l.date <= ${param(args.to)}`);
  const from = `FROM change_log l JOIN employees e ON e.id = l.employee_id
    LEFT JOIN employees m ON m.id = l.manager_id LEFT JOIN employees pm ON pm.id = l.prev_manager_id
    WHERE ${where.join(' AND ')}`;
  const { rows: [count] } = await db.query(`SELECT count(*) AS n, count(DISTINCT l.employee_id) AS people ${from}`, params);
  const { rows } = await db.query(
    `SELECT l.*, e.code, e.first_name || ' ' || e.last_name AS name,
       m.code AS manager_code, m.first_name || ' ' || m.last_name AS manager_name,
       pm.code AS prev_manager_code, pm.first_name || ' ' || pm.last_name AS prev_manager_name
     ${from} ORDER BY l.date DESC, l.source DESC, l.id DESC LIMIT ${Math.min(args.limit, MAX_ROWS)} OFFSET ${args.offset}`,
    params,
  );
  const out = rows.map((r) => {
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    if (r.source === 'change') {
      for (const field of FIELDS) if (r[field] !== null && r[field] !== r[`prev_${field}`]) changes.push({ field, from: r[`prev_${field}`], to: r[field] });
      if (r.manager_set && r.manager_id !== r.prev_manager_id) {
        changes.push({
          field: 'manager',
          from: r.prev_manager_code ? { code: r.prev_manager_code, name: r.prev_manager_name } : null,
          to: r.manager_code ? { code: r.manager_code, name: r.manager_name } : null,
        });
      }
      if (r.salary !== null && (r.salary !== r.prev_salary || r.currency !== r.prev_currency)) {
        const money = (amount: number | null, currency: string | null): Money | null => (amount === null ? null : { amount, currency: currency! });
        changes.push({ field: 'salary', from: money(r.prev_salary, r.prev_currency), to: money(r.salary, r.currency) });
      }
    }
    const pct = r.kinds.includes('raise') || r.kinds.includes('pay_cut') ? Math.round(((r.salary - r.prev_salary) / r.prev_salary) * 1000) / 10 : undefined;
    return { code: r.code, name: r.name, date: r.date, kinds: r.kinds, note: r.note, ...(pct === undefined ? {} : { raisePct: pct }), changes };
  });
  const label = [describeFilters(f), args.kinds?.join(' or '), (args.from || args.to) && `${args.from ?? '…'} to ${args.to ?? '…'}`]
    .filter(Boolean).join(' · ');
  const people = [...new Map(out.map((r) => [r.code, r.name])).entries()].slice(0, PEOPLE_IN_SOURCES);
  return {
    result: { total: count.n, rows: out },
    sources: [
      { kind: 'group', label, query: listQueryOf(f), headcount: count.people },
      ...people.map(([code, name]) => ({ kind: 'person' as const, code, name })),
    ],
  };
}

const GROUP_BY = ['country', 'department', 'role', 'level', 'gender', 'status', 'hire_year', 'manager'] as const;
type GroupBy = (typeof GROUP_BY)[number];
const GROUP_SQL: Record<GroupBy, string> = {
  country: 's.country', department: 's.department', role: 's.role', level: 's.level', gender: 'e.gender',
  status: `(${STATUS_SQL})`, hire_year: 'extract(year FROM e.hire_date)::int', manager: 'gm.code',
};
const GROUP_ORDER: Partial<Record<GroupBy, string>> = {
  country: `array_position(ARRAY['US','IN','GB','DE','BR','JP'], s.country)`,
  department: `array_position(ARRAY[${DEPARTMENTS.map((d) => `'${d}'`).join(',')}], s.department)`,
};

const aggregateSchema = z
  .object({
    metric: z.enum(['salary', 'headcount', 'raise_pct']).describe(
      'salary: median, min, max and headcount of annual base salary (always per currency); headcount: number of people; ' +
        'raise_pct: median, min, max and count of raise or pay-cut percentages between `from` and `to`',
    ),
    groupBy: z.array(z.enum(GROUP_BY)).max(4).default([]),
    filters: filtersSchema.default({}).describe("Which people; default: everyone employed on the date (not starting, not left)"),
    asOf: date.optional().describe('Date for salary and headcount (default today)'),
    from: date.optional().describe('raise_pct: changes on or after'),
    to: date.optional().describe('raise_pct: changes on or before'),
  })
  .strict();

const MAX_GROUPS = 500;
const PCT = (expr: string) => `round(${expr}::numeric, 1)::float`;

async function aggregate(db: Db, today: string, args: z.infer<typeof aggregateSchema>): Promise<ToolResult> {
  const f = args.filters;
  if (salaryNeedsOneCountry(f)) return { result: { error: 'Salary filters need exactly one country.' }, sources: [] };
  const asOf = args.metric === 'raise_pct' ? today : (args.asOf ?? today);
  const { params, fromWhere } = listFilter(toFilters(f), asOf);
  const keys = args.groupBy;
  const select = keys.map((k) => `${GROUP_SQL[k]} AS ${k}`);
  const groupCols = keys.map((k) => GROUP_SQL[k]);
  const order = keys.map((k) => GROUP_ORDER[k] ?? GROUP_SQL[k]);
  const join = keys.includes('manager') ? 'LEFT JOIN employees gm ON gm.id = s.manager_id' : '';
  const notStarting = f.status?.includes('starting') ? [] : [`(${STATUS_SQL}) <> 'starting'`];
  let sql: string;
  if (args.metric === 'raise_pct') {
    const where = [`l.kinds && ARRAY['raise','pay_cut']`];
    if (args.from) where.push(`l.date >= $${params.push(args.from)}`);
    if (args.to) where.push(`l.date <= $${params.push(args.to)}`);
    const pct = '(l.salary - l.prev_salary) * 100.0 / l.prev_salary';
    sql = `SELECT ${[...select, `${PCT(`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${pct})`)} AS median`,
      `${PCT(`min(${pct})`)} AS min`, `${PCT(`max(${pct})`)} AS max`, 'count(*)::int AS count'].join(', ')}
      ${fromWhere(where, `${join} JOIN change_log l ON l.employee_id = e.id`)}`;
  } else {
    const stats = args.metric === 'salary' ? [`s.currency`, PAY_STATS] : ['count(*)::int AS headcount'];
    if (args.metric === 'salary') {
      groupCols.unshift('s.currency');
      order.unshift(CURRENCY_ORDER);
    }
    sql = `SELECT ${[...select, ...stats].join(', ')} ${fromWhere(notStarting, join)}`;
  }
  if (groupCols.length) sql += ` GROUP BY ${groupCols.join(', ')} ORDER BY ${order.join(', ')}`;
  const { rows } = await db.query(`${sql} LIMIT ${MAX_GROUPS}`, params);
  const groupFilters = (g: Record<string, unknown>): ToolFilters => {
    const merged: ToolFilters = { ...f };
    if (g.country) merged.country = [g.country as Country];
    if (g.department) merged.department = [g.department as (typeof DEPARTMENTS)[number]];
    if (g.role) merged.role = [g.role as (typeof ROLE_NAMES)[number]];
    if (g.level) merged.level = [g.level as number];
    if (g.gender) merged.gender = [g.gender as (typeof GENDERS)[number]];
    if (g.status) merged.status = [g.status as (typeof STATUSES)[number]];
    if (g.manager) merged.managerCode = g.manager as string;
    return merged;
  };
  return {
    result: { groups: rows },
    sources: rows.slice(0, PEOPLE_IN_SOURCES).map((g) => {
      const merged = groupFilters(g);
      const label = [describeFilters(merged), g.hire_year && `hired in ${g.hire_year}`].filter(Boolean).join(' · ');
      return { kind: 'group' as const, label, query: listQueryOf(merged), headcount: (g.headcount ?? g.count) as number };
    }),
  };
}

const TOOLS_BY_NAME = {
  query_employees: { schema: queryEmployeesSchema, run: queryEmployees },
  get_employee: { schema: getEmployeeSchema, run: getEmployee },
  query_changes: { schema: queryChangesSchema, run: queryChanges },
  aggregate: { schema: aggregateSchema, run: aggregate },
} as const;

/** Runs one tool call from the model. Never throws for bad input: the error goes back to the model. */
export async function runTool(db: pg.Pool, today: string, name: string, args: unknown): Promise<ToolResult> {
  if (!Object.hasOwn(TOOLS_BY_NAME, name)) return { result: { error: `There is no tool called "${name}".` }, sources: [] };
  const tool = TOOLS_BY_NAME[name as keyof typeof TOOLS_BY_NAME];
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { result: { error: z.prettifyError(parsed.error) }, sources: [] };
  return readOnlyTx(db, (tx) => (tool.run as (db: Db, today: string, args: unknown) => Promise<ToolResult>)(tx, today, parsed.data));
}


export type ToolSpec = { type: 'function'; function: { name: string; description: string; parameters: unknown } };
export const TOOLS: ToolSpec[] = [];
