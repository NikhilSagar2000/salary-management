import type pg from 'pg';
import { peerStats } from '../stats/peers.ts';

export type Status = 'starting' | 'active' | 'leaving' | 'left';

export function statusOn(today: string, hireDate: string, leaveDate: string | null): Status {
  if (hireDate > today) return 'starting';
  if (leaveDate && leaveDate <= today) return 'left';
  return leaveDate ? 'leaving' : 'active';
}

/** Everything the employee page shows, or null when the code is unknown. */
export async function employeeDetail(db: pg.Pool, code: string, today: string) {
  const { rows } = await db.query('SELECT * FROM employees WHERE code = $1', [code]);
  const e = rows[0];
  if (!e) return null;
  const asOf = e.hire_date > today ? e.hire_date : today;
  const s = (await db.query('SELECT * FROM employee_state($1) WHERE employee_id = $2', [asOf, e.id])).rows[0];
  const peers = await peerStats(db, today, s);
  const manager = s.manager_id
    ? (await db.query('SELECT code, first_name, last_name, leave_date FROM employees WHERE id = $1', [s.manager_id])).rows[0]
    : null;
  const { rows: reports } = await db.query(
    `SELECT e.code, e.first_name || ' ' || e.last_name AS name
     FROM employee_state($1) s JOIN employees e ON e.id = s.employee_id
     WHERE s.manager_id = $2 AND (e.leave_date IS NULL OR e.leave_date > $1)
     ORDER BY e.last_name, e.first_name, e.code`,
    [today, e.id],
  );
  return {
    code: e.code,
    firstName: e.first_name,
    lastName: e.last_name,
    gender: e.gender,
    workEmail: e.work_email,
    hireDate: e.hire_date,
    leaveDate: e.leave_date,
    leaveReason: e.leave_reason,
    status: statusOn(today, e.hire_date, e.leave_date),
    version: e.version,
    current: { country: s.country, currency: s.currency, department: s.department, role: s.role, level: s.level, salary: s.salary,
      manager: manager && {
        code: manager.code,
        name: `${manager.first_name} ${manager.last_name}`,
        hasLeft: !!manager.leave_date && manager.leave_date <= today,
      },
    },
    peers: peers && { ...peers, position: Math.round(((s.salary - peers.median) / peers.median) * 100) },
    reports,
  };
}
