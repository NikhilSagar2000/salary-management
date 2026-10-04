import type { ListQuery } from '@acme/shared';
import type pg from 'pg';

/** SQL: a person's status on date $1 (matches statusOn in detail.ts). */
export const STATUS_SQL = `CASE WHEN e.hire_date > $1 THEN 'starting' WHEN e.leave_date <= $1 THEN 'left'
  WHEN e.leave_date IS NOT NULL THEN 'leaving' ELSE 'active' END`;

/** One page of the employee list plus the total match count. Filtering, sorting and paging happen in Postgres. */
const ORDER: Record<Exclude<ListQuery['sort'], 'salary'>, string[]> = {
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
  const from = `FROM employees e JOIN current_state($1) s ON s.employee_id = e.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const total = (await db.query(`SELECT count(*) AS n ${from}`, params)).rows[0].n as number;
  const { rows } = await db.query(
    `SELECT e.code ${from} ORDER BY ${orderBy(q)} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    params,
  );
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

/** ORDER BY for the chosen column and direction; ties always by code, so paging is stable. */
function orderBy(q: ListQuery) {
  const columns = q.sort === 'salary' ? [] : ORDER[q.sort];
  const dir = q.dir === 'desc' ? 'DESC' : 'ASC';
  return [...columns.map((c) => `${c} ${dir}`), `e.code ${q.sort === 'code' ? dir : 'ASC'}`].join(', ');
}
