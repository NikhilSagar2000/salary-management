import type pg from 'pg';

/** SQL: people counted in pay statistics on date $1 — hired by then and not yet left (STATS-2). */
export const COUNTED_ON = 'e.hire_date <= $1 AND (e.leave_date IS NULL OR e.leave_date > $1)';

/** Median (percentile_cont, rounded half away from zero), min, max and headcount (STATS-1). */
export const PAY_STATS = `round(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.salary)::numeric)::bigint AS median,
  min(s.salary) AS min, max(s.salary) AS max, count(*) AS headcount`;

/** Pay of people with the same country, role and level on `date`, or null when there are none. */
export async function peerStats(db: pg.Pool, date: string, job: { country: string; role: string; level: number }) {
  const { rows } = await db.query(
    `SELECT max(s.currency) AS currency, ${PAY_STATS}
     FROM employee_state($1) s JOIN employees e ON e.id = s.employee_id
     WHERE ${COUNTED_ON} AND s.country = $2 AND s.role = $3 AND s.level = $4`,
    [date, job.country, job.role, job.level],
  );
  return rows[0].headcount ? (rows[0] as { currency: string; median: number; min: number; max: number; headcount: number }) : null;
}
