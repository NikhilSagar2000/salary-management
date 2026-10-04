import type { Status } from '@acme/shared';
import type { Db } from '../db.ts';
import { peerStats } from '../stats/peers.ts';

export function statusOn(today: string, hireDate: string, leaveDate: string | null): Status {
  if (hireDate > today) return 'starting';
  if (leaveDate && leaveDate <= today) return 'left';
  return leaveDate ? 'leaving' : 'active';
}

/** Everything the employee page shows, or null when the code is unknown. */
export async function employeeDetail(db: Db, code: string, today: string) {
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
    timeline: await timeline(db, e.id, today, e.leave_date),
  };
}

type Money = { amount: number; currency: string };
type Person = { code: string; name: string };
type Value = string | number | Money | Person | null;

/** Changes (with from → to against the changes that apply before them) and leave events, in date order. */
async function timeline(db: Db, employeeId: number, today: string, leaveDate: string | null) {
  const { rows: changes } = await db.query(
    `SELECT c.*, m.code AS manager_code, m.first_name || ' ' || m.last_name AS manager_name
     FROM job_changes c LEFT JOIN employees m ON m.id = c.manager_id
     WHERE c.employee_id = $1 ORDER BY c.effective_date, c.id`,
    [employeeId],
  );
  const running: Record<string, Value> = { country: null, department: null, role: null, level: null, manager: null, salary: null };
  const entries = changes.map((c, i) => {
    const set: [string, Value][] = [];
    if (c.country !== null) set.push(['country', c.country]);
    if (c.department !== null) set.push(['department', c.department]);
    if (c.role !== null) set.push(['role', c.role]);
    if (c.level !== null) set.push(['level', c.level]);
    if (c.manager_set) set.push(['manager', c.manager_id === null ? null : { code: c.manager_code, name: c.manager_name }]);
    if (c.salary !== null) set.push(['salary', { amount: c.salary, currency: c.currency }]);
    const diffs = set
      .filter(([field, to]) => JSON.stringify(running[field]) !== JSON.stringify(to))
      .map(([field, to]) => ({ field, from: running[field] ?? null, to }));
    const cancelled = c.cancelled_at !== null;
    const wontApply = !cancelled && !!leaveDate && c.effective_date > leaveDate;
    if (!cancelled && !wontApply) for (const [field, to] of set) running[field] = to;
    return {
      type: 'change' as const, id: Number(c.id), date: c.effective_date as string, hire: i === 0, note: c.note,
      scheduled: c.effective_date > today, cancelled, wontApply, changes: diffs,
    };
  });
  const { rows: events } = await db.query('SELECT id, kind, leave_date, reason FROM leave_events WHERE employee_id = $1 ORDER BY id', [employeeId]);
  const leaves = events.map((ev) =>
    ev.kind === 'left'
      ? { type: 'left' as const, date: ev.leave_date as string, reason: ev.reason }
      : { type: 'undone' as const, date: ev.leave_date as string },
  );
  // Stable sort by date keeps changes before leave events on the same day.
  return [...entries, ...leaves].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
