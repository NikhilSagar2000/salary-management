import type { ListQuery } from '@acme/shared';
import type pg from 'pg';
import { CURRENCY_ORDER, PAY_STATS } from '../stats/peers.ts';

/** SQL: a person's status on date $1 (matches statusOn in detail.ts). */
export const STATUS_SQL = `CASE WHEN e.hire_date > $1 THEN 'starting' WHEN e.leave_date <= $1 THEN 'left'
  WHEN e.leave_date IS NOT NULL THEN 'leaving' ELSE 'active' END`;

/** One page of the employee list plus the total match count. Filtering, sorting and paging happen in Postgres. */
const ORDER: Record<ListQuery['sort'], string[]> = {
  salary: ['s.salary'], // only reachable with one country filtered (one currency)
  name: ['e.last_name', 'e.first_name'],
  code: [],
  country: ['s.country'],
  department: ['s.department'],
  role: ['s.role'],
  level: ['s.level'],
  hireDate: ['e.hire_date'],
};

export async function listEmployees(db: pg.Pool, q: ListQuery, today: string) {
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
  anyOf(`(${STATUS_SQL})`, q.status);
  if (q.salaryMin !== undefined) where.push(`s.salary >= ${param(q.salaryMin)}`);
  if (q.salaryMax !== undefined) where.push(`s.salary <= ${param(q.salaryMax)}`);
  const from = `FROM employees e JOIN current_state($1) s ON s.employee_id = e.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const total = (await db.query(`SELECT count(*) AS n ${from}`, params)).rows[0].n as number;
  const { rows } = await db.query(
    `SELECT e.code, e.first_name AS "firstName", e.last_name AS "lastName", s.country, s.currency, s.department, s.role,
       s.level, s.salary, e.hire_date AS "hireDate", e.leave_date AS "leaveDate", ${STATUS_SQL} AS status
     ${from} ORDER BY ${orderBy(q)} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    params,
  );
  const { rows: stats } = await db.query(`SELECT s.currency, ${PAY_STATS} ${from} GROUP BY s.currency ORDER BY ${CURRENCY_ORDER}`, params);
  return { rows, total, page: q.page, pageSize: q.pageSize, stats };
}

/** ORDER BY for the chosen column and direction; ties always by code, so paging is stable. */
function orderBy(q: ListQuery) {
  const columns = ORDER[q.sort];
  const dir = q.dir === 'desc' ? 'DESC' : 'ASC';
  return [...columns.map((c) => `${c} ${dir}`), `e.code ${q.sort === 'code' ? dir : 'ASC'}`].join(', ');
}
