// The pay assistant's tools (AST-4, AST-5): read-only, typed arguments, no SQL from the model.
import { COUNTRIES, COUNTRY_NAMES, CURRENCY, DEPARTMENTS, formatMoney, GENDERS, MSG, ROLE_NAMES, SORTS, STATUSES } from '@acme/shared';
import type pg from 'pg';
import { z } from 'zod';
import { employeeDetail } from '../employees/detail.ts';
import { listFilter, STATUS_SQL, type Filters } from '../employees/list.ts';

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

async function queryEmployees(db: pg.Pool, today: string, args: z.infer<typeof queryEmployeesSchema>): Promise<ToolResult> {
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

async function getEmployee(db: pg.Pool, today: string, args: z.infer<typeof getEmployeeSchema>): Promise<ToolResult> {
  const detail = await employeeDetail(db, args.code, today);
  if (!detail) return { result: { error: MSG.noEmployee(args.code) }, sources: [] };
  return { result: detail, sources: [{ kind: 'person', code: detail.code, name: `${detail.firstName} ${detail.lastName}` }] };
}

const TOOLS_BY_NAME = {
  query_employees: { schema: queryEmployeesSchema, run: queryEmployees },
  get_employee: { schema: getEmployeeSchema, run: getEmployee },
} as const;

/** Runs one tool call from the model. Never throws for bad input: the error goes back to the model. */
export async function runTool(db: pg.Pool, today: string, name: string, args: unknown): Promise<ToolResult> {
  const tool = TOOLS_BY_NAME[name as keyof typeof TOOLS_BY_NAME];
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { result: { error: parsed.error.message }, sources: [] };
  return (tool.run as (db: pg.Pool, today: string, args: unknown) => Promise<ToolResult>)(db, today, parsed.data);
}

