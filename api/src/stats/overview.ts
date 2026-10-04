import { CURRENCY, DEPARTMENTS, type Country } from '@acme/shared';
import type pg from 'pg';
import { COUNTED_ON, PAY_STATS } from './peers.ts';

/** Department × level pay for one country, people employed on `today` (STATS-3). Empty cells are omitted. */
export async function payOverview(db: pg.Pool, country: Country, today: string) {
  const { rows: cells } = await db.query(
    `SELECT s.department, s.level, ${PAY_STATS}
     FROM employee_state($1) s JOIN employees e ON e.id = s.employee_id
     WHERE ${COUNTED_ON} AND s.country = $2
     GROUP BY s.department, s.level
     ORDER BY array_position($3::text[], s.department), s.level`,
    [today, country, DEPARTMENTS],
  );
  return { country, currency: CURRENCY[country], cells };
}
