import { CURRENCY, type Country, type JobChange } from '@acme/shared';
import type pg from 'pg';
import { withTx } from '../db.ts';

/** Adds a dated job change if `version` is current; returns the new version, or null if nothing matched. */
export async function addChange(db: pg.Pool, code: string, c: JobChange): Promise<number | null> {
  return withTx(db, async (tx) => {
    const bumped = await tx.query(
      'UPDATE employees SET version = version + 1, updated_at = now() WHERE code = $1 AND version = $2 RETURNING id, version',
      [code, c.version],
    );
    if (!bumped.rowCount) return null;
    const { id, version } = bumped.rows[0];
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
    return version as number;
  });
}
