import type { ListQuery } from '@acme/shared';
import type pg from 'pg';

/** One page of the employee list plus the total match count. Filtering, sorting and paging happen in Postgres. */
export async function listEmployees(db: pg.Pool, q: ListQuery, today: string) {
  const params: unknown[] = [today];
  const where: string[] = [];
  const param = (value: unknown) => `$${params.push(value)}`;
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(`employee_search_text(e.first_name, e.last_name, e.work_email, e.code) LIKE f_unaccent(lower(${param(like)}))`);
  }
  const from = `FROM employees e JOIN current_state($1) s ON s.employee_id = e.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const total = (await db.query(`SELECT count(*) AS n ${from}`, params)).rows[0].n as number;
  const { rows } = await db.query(
    `SELECT e.code ${from} ORDER BY e.last_name, e.first_name, e.code LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    params,
  );
  return { rows, total, page: q.page, pageSize: q.pageSize };
}
