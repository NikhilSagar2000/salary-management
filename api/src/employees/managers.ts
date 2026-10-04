import { formatDate, MSG } from '@acme/shared';
import type pg from 'pg';
import { FieldProblem } from '../http.ts';

/**
 * The manager's id for a change on `date` (null = no manager), or a FieldProblem (EMP-10):
 * the manager must exist, not be the person, be employed on that date, and not create a loop.
 */
export async function resolveManager(tx: pg.PoolClient, self: number | null, code: string | null, date: string) {
  if (code === null) return null;
  const { rows } = await tx.query('SELECT id, first_name, last_name, hire_date, leave_date FROM employees WHERE code = $1', [code]);
  const m = rows[0];
  if (!m) throw new FieldProblem({ managerCode: MSG.noEmployee(code) });
  if (m.id === self) throw new FieldProblem({ managerCode: MSG.ownManager });
  if (m.hire_date > date || (m.leave_date && m.leave_date <= date)) {
    throw new FieldProblem({ managerCode: MSG.managerNotEmployed(`${m.first_name} ${m.last_name}`, formatDate(date)) });
  }
  if (self !== null) {
    const loop = await tx.query(
      `WITH RECURSIVE s AS MATERIALIZED (SELECT employee_id, manager_id FROM employee_state($1)),
       chain (id, depth) AS (
         SELECT manager_id, 1 FROM s WHERE employee_id = $2
         UNION ALL
         SELECT s.manager_id, chain.depth + 1 FROM chain JOIN s ON s.employee_id = chain.id WHERE chain.depth < 100
       )
       SELECT 1 FROM chain WHERE id = $3 LIMIT 1`,
      [date, m.id, self],
    );
    if (loop.rowCount) throw new FieldProblem({ managerCode: MSG.managerLoop });
  }
  return m.id as number;
}
