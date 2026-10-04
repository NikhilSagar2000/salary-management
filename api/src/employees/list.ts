import type { ListQuery } from '@acme/shared';
import type pg from 'pg';

/** One page of the employee list plus the total match count. Filtering, sorting and paging happen in Postgres. */
export async function listEmployees(db: pg.Pool, q: ListQuery, today: string) {
  const params: unknown[] = [today];
  const from = `FROM employees e JOIN current_state($1) s ON s.employee_id = e.id`;
  const total = (await db.query(`SELECT count(*) AS n ${from}`, params)).rows[0].n as number;
  const { rows } = await db.query(
    `SELECT e.code ${from} ORDER BY e.last_name, e.first_name, e.code LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    params,
  );
  return { rows, total, page: q.page, pageSize: q.pageSize };
}
