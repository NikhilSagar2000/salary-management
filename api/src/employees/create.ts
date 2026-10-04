import { CURRENCY, MSG, type EmployeeCreate } from '@acme/shared';
import type pg from 'pg';
import { withTx } from '../db.ts';
import { resolveManager } from './managers.ts';

export async function nextCode(db: pg.Pool): Promise<string> {
  const { rows } = await db.query("SELECT coalesce(max(substr(code, 2)::int), 0) + 1 AS n FROM employees");
  return `E${String(rows[0].n).padStart(6, '0')}`;
}

/** Field problems from unique constraints, or null when the error is something else. */
export function duplicateField(err: unknown, e: { code: string }): Record<string, string> | null {
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr.code !== '23505') return null;
  if (pgErr.constraint === 'employees_code_key') return { code: MSG.codeUsed(e.code) };
  if (pgErr.constraint === 'employees_work_email_key') return { workEmail: MSG.emailUsed };
  return null;
}

/** Saves the person and their hire change (every field set, dated on the hire date) together. */
export async function createEmployee(db: pg.Pool, e: EmployeeCreate) {
  await withTx(db, async (tx) => {
    const managerId = await resolveManager(tx, null, e.managerCode ?? null, e.hireDate);
    const { rows } = await tx.query(
      `INSERT INTO employees (code, first_name, last_name, gender, work_email, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [e.code, e.firstName, e.lastName, e.gender, e.workEmail, e.hireDate],
    );
    await tx.query(
      `INSERT INTO job_changes (employee_id, effective_date, country, department, role, level, manager_set, manager_id, salary, currency)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)`,
      [rows[0].id, e.hireDate, e.country, e.department, e.role, e.level, managerId, e.salary, CURRENCY[e.country]],
    );
  });
  return { code: e.code, version: 1 };
}
