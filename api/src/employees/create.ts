import type { EmployeeCreate } from '@acme/shared';
import type pg from 'pg';

export async function nextCode(db: pg.Pool): Promise<string> {
  const { rows } = await db.query("SELECT coalesce(max(substr(code, 2)::int), 0) + 1 AS n FROM employees");
  return `E${String(rows[0].n).padStart(6, '0')}`;
}

export async function createEmployee(db: pg.Pool, e: EmployeeCreate) {
  await db.query(
    `INSERT INTO employees (code, first_name, last_name, gender, work_email, hire_date) VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.code, e.firstName, e.lastName, e.gender, e.workEmail, e.hireDate],
  );
  return { code: e.code, version: 1 };
}
