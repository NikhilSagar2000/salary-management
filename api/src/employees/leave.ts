import type { Leave } from '@acme/shared';
import type pg from 'pg';
import { withTx } from '../db.ts';

/** Marks someone as leaving/left if `version` is current; returns the new version, or null if nothing matched. */
export async function markLeaving(db: pg.Pool, code: string, l: Leave): Promise<number | null> {
  return withTx(db, async (tx) => {
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
