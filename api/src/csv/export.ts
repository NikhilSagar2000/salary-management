import type { ListQuery } from '@acme/shared';
import type pg from 'pg';
import { listFilter, STATUS_SQL } from '../employees/list.ts';
import { toCsv } from './format.ts';

export const CSV_COLUMNS = [
  'code', 'first_name', 'last_name', 'gender', 'work_email', 'country', 'department', 'role', 'level', 'salary',
  'currency', 'hire_date', 'manager_code', 'status', 'leave_date', 'leave_reason',
] as const;

/** Every employee matching the list filters (no paging), in list order, as CSV (CSV-1). */
export async function exportCsv(db: pg.Pool, q: ListQuery, today: string): Promise<string> {
  const { params, fromWhere, orderBy } = listFilter(q, today);
  const { rows } = await db.query(
    `SELECT e.code, e.first_name, e.last_name, e.gender, e.work_email, s.country, s.department, s.role, s.level, s.salary,
       s.currency, e.hire_date, m.code AS manager_code, ${STATUS_SQL} AS status, e.leave_date, e.leave_reason
     ${fromWhere([], 'LEFT JOIN employees m ON m.id = s.manager_id')}
     ORDER BY ${orderBy}`,
    params,
  );
  return toCsv([[...CSV_COLUMNS], ...rows.map((r) => CSV_COLUMNS.map((c) => r[c]))]);
}
