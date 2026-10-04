import { formatDate, MSG, type Leave } from '@acme/shared';
import type pg from 'pg';
import { withTx } from '../db.ts';
import { FieldProblem } from '../http.ts';

/** Marks someone as leaving/left if `version` is current; returns the new version, or null if nothing matched. */
export async function markLeaving(db: pg.Pool, code: string, l: Leave): Promise<number | null> {
  return withTx(db, async (tx) => {
    const hire = (await tx.query('SELECT hire_date FROM employees WHERE code = $1', [code])).rows[0]?.hire_date;
    if (hire && l.leaveDate < hire) throw new FieldProblem({ leaveDate: MSG.leaveBeforeHire(formatDate(hire)) });
    const { rows } = await tx.query(
      `UPDATE employees SET leave_date = $3, leave_reason = $4, version = version + 1, updated_at = now()
       WHERE code = $1 AND version = $2 RETURNING id, version`,
      [code, l.version, l.leaveDate, l.reason || null],
    );
    if (!rows[0]) return null;
    await tx.query("INSERT INTO leave_events (employee_id, kind, leave_date, reason) VALUES ($1, 'left', $2, $3)", [rows[0].id, l.leaveDate, l.reason || null]);
    return rows[0].version as number;
  });
}

/** Undoes leaving if `version` is current; returns the new version, or null if nothing matched. */
export async function undoLeaving(db: pg.Pool, code: string, version: number, now: Date): Promise<number | null> {
  return withTx(db, async (tx) => {
    const { rows } = await tx.query(
      `UPDATE employees e SET leave_date = NULL, leave_reason = NULL, version = e.version + 1, updated_at = now()
       FROM employees old WHERE old.id = e.id AND e.code = $1 AND e.version = $2
       RETURNING e.id, e.version, old.leave_date`,
      [code, version],
    );
    if (!rows[0]) return null;
    if (!rows[0].leave_date) throw new FieldProblem({ form: MSG.notLeaving });
    await tx.query("INSERT INTO leave_events (employee_id, kind, leave_date, created_at) VALUES ($1, 'undone', $2, $3)", [rows[0].id, rows[0].leave_date, now]);
    return rows[0].version as number;
  });
}
