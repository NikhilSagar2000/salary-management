import { COUNTRY_NAMES, DEFAULT_STATUSES, type ListQuery } from '@acme/shared';
import type pg from 'pg';

/** SQL: a person's status on date $1 (matches statusOn in detail.ts). */
export const STATUS_SQL = `CASE WHEN e.hire_date > $1 THEN 'starting' WHEN e.leave_date <= $1 THEN 'left'
  WHEN e.leave_date IS NOT NULL THEN 'leaving' ELSE 'active' END`;

// The list shows country names, so it sorts by them (codes are fixed constants, safe to inline).
const COUNTRIES_BY_NAME = Object.entries(COUNTRY_NAMES).sort(([, a], [, b]) => a.localeCompare(b)).map(([code]) => `'${code}'`);

const ORDER: Record<ListQuery['sort'], string[]> = {
  salary: ['s.salary'], // only reachable with one country filtered (one currency)
  name: ['e.last_name', 'e.first_name'],
  code: [],
  country: [`array_position(ARRAY[${COUNTRIES_BY_NAME.join(', ')}], s.country)`],
  department: ['s.department'],
  role: ['s.role'],
  level: ['s.level'],
  hireDate: ['e.hire_date'],
};

/** The list's filters plus the extra ones the assistant's tools use. */
export type Filters = Partial<Omit<ListQuery, 'page' | 'pageSize'>> & {
  codes?: string[]; hiredFrom?: string; hiredTo?: string; leftFrom?: string; leftTo?: string; managerCode?: string;
};

/** The filters as SQL: `fromWhere()` (FROM … WHERE …, aliases e and s), its `params` ($1 = today) and `orderBy`. */
export function listFilter(q: Filters, today: string) {
  const params: unknown[] = [today];
  const where: string[] = [];
  const param = (value: unknown) => `$${params.push(value)}`;
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(`employee_search_text(e.first_name, e.last_name, e.work_email, e.code) LIKE f_unaccent(lower(${param(like)}))`);
  }
  const anyOf = (column: string, values: unknown[] | undefined) => {
    if (values) where.push(`${column} = ANY(${param(values)})`);
  };
  anyOf('s.country', q.country);
  anyOf('s.department', q.department);
  anyOf('s.role', q.role);
  anyOf('s.level', q.level);
  anyOf('e.gender', q.gender);
  anyOf(`(${STATUS_SQL})`, q.status ?? DEFAULT_STATUSES);
  if (q.salaryMin !== undefined) where.push(`s.salary >= ${param(q.salaryMin)}`);
  if (q.salaryMax !== undefined) where.push(`s.salary <= ${param(q.salaryMax)}`);
  anyOf('e.code', q.codes);
  if (q.hiredFrom) where.push(`e.hire_date >= ${param(q.hiredFrom)}`);
  if (q.hiredTo) where.push(`e.hire_date <= ${param(q.hiredTo)}`);
  if (q.leftFrom) where.push(`e.leave_date >= ${param(q.leftFrom)}`);
  if (q.leftTo) where.push(`e.leave_date <= ${param(q.leftTo)}`);
  if (q.managerCode) where.push(`s.manager_id = (SELECT id FROM employees WHERE code = ${param(q.managerCode)})`);
  const fromWhere = (extra: string[] = [], join = '') => {
    const all = [...where, ...extra];
    return `FROM employees e JOIN current_state($1) s ON s.employee_id = e.id ${join} ${all.length ? `WHERE ${all.join(' AND ')}` : ''}`;
  };
  return { params, fromWhere, orderBy: orderBy(q) };
}

/** One page of the employee list and the total match count. All done in Postgres. */
export async function listEmployees(db: pg.Pool, q: ListQuery, today: string) {
  const { params, fromWhere, orderBy } = listFilter(q, today);
  const from = fromWhere();
  const total = (await db.query(`SELECT count(*) AS n ${from}`, params)).rows[0].n as number;
  const { rows } = await db.query(
    `SELECT e.code, e.first_name AS "firstName", e.last_name AS "lastName", s.country, s.currency, s.department, s.role,
       s.level, s.salary, e.hire_date AS "hireDate", e.leave_date AS "leaveDate", ${STATUS_SQL} AS status
     ${from} ORDER BY ${orderBy} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    params,
  );
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

/** ORDER BY for the chosen column and direction; ties always by code, so paging is stable. */
function orderBy(q: Filters) {
  const columns = ORDER[q.sort ?? 'name'];
  const dir = q.dir === 'desc' ? 'DESC' : 'ASC';
  return [...columns.map((c) => `${c} ${dir}`), `e.code ${q.sort === 'code' ? dir : 'ASC'}`].join(', ');
}
