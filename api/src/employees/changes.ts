import { COUNTRY_NAMES, CURRENCY, formatDate, jobProblems, MSG, type Country, type JobChange } from '@acme/shared';
import type pg from 'pg';
import { withTx } from '../db.ts';
import { FieldProblem } from '../http.ts';

/** Adds a dated job change if `version` is current; returns the new version, or null if nothing matched. */
export async function addChange(db: pg.Pool, code: string, c: JobChange): Promise<number | null> {
  return withTx(db, async (tx) => {
    const bumped = await tx.query(
      `UPDATE employees SET version = version + 1, updated_at = now() WHERE code = $1 AND version = $2
       RETURNING id, version, hire_date, leave_date`,
      [code, c.version],
    );
    if (!bumped.rowCount) return null;
    const { id, version, hire_date, leave_date } = bumped.rows[0];
    if (c.effectiveDate < hire_date) throw new FieldProblem({ effectiveDate: MSG.changeBeforeHire(formatDate(hire_date)) });
    if (leave_date && c.effectiveDate > leave_date) throw new FieldProblem({ effectiveDate: MSG.changeAfterLeave(formatDate(leave_date)) });
    let currency: string | null = null;
    if (c.salary !== undefined) {
      const country = c.country ?? (await tx.query('SELECT country FROM employee_state($1) WHERE employee_id = $2', [c.effectiveDate, id])).rows[0]?.country;
      currency = CURRENCY[country as Country];
    }
    await tx.query(
      `INSERT INTO job_changes (employee_id, effective_date, country, department, role, level, salary, currency, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, c.effectiveDate, c.country, c.department, c.role, c.level, c.salary, currency, c.note],
    );
    await checkTimeline(tx, id, c.effectiveDate);
    return version as number;
  });
}

/** Re-checks the person's state on the change's date and every later change date; throws on the first problem. */
async function checkTimeline(tx: pg.PoolClient, employeeId: number, from: string) {
  const { rows: dates } = await tx.query(
    `SELECT DISTINCT c.effective_date AS d FROM job_changes c JOIN employees e ON e.id = c.employee_id
     WHERE c.employee_id = $1 AND c.cancelled_at IS NULL AND c.effective_date >= $2
       AND (e.leave_date IS NULL OR c.effective_date <= e.leave_date)
     ORDER BY 1`,
    [employeeId, from],
  );
  for (const { d } of dates) {
    const state = (await tx.query('SELECT * FROM employee_state($1) WHERE employee_id = $2', [d, employeeId])).rows[0];
    const prefix = d === from ? '' : `On ${formatDate(d)}: `;
    for (const p of jobProblems(state)) throw new FieldProblem({ [String(p.path[0])]: prefix + p.message });
    if (state.currency !== CURRENCY[state.country as Country]) {
      throw new FieldProblem({ country: MSG.laterSalaryWrongCurrency(formatDate(d), state.currency, COUNTRY_NAMES[state.country as Country]) });
    }
  }
}
