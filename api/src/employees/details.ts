import type { EmployeeDetails } from '@acme/shared';
import type pg from 'pg';

/** Updates personal details if `version` is current; returns the new version, or null if nothing matched. */
export async function updateDetails(db: pg.Pool, code: string, d: EmployeeDetails): Promise<number | null> {
  const { rows } = await db.query(
    `UPDATE employees SET
       first_name = coalesce($3, first_name), last_name = coalesce($4, last_name),
       gender = coalesce($5, gender), work_email = coalesce($6, work_email),
       version = version + 1, updated_at = now()
     WHERE code = $1 AND version = $2 RETURNING version`,
    [code, d.version, d.firstName, d.lastName, d.gender, d.workEmail],
  );
  return rows[0]?.version ?? null;
}
