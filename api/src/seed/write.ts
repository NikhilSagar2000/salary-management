import type pg from 'pg';
import { withTx } from '../db.ts';
import type { Seed } from './generate.ts';

const CHUNK = 5000;
const chunks = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

/** Inserts the seed into an empty database in one transaction, in batches. */
export async function writeSeed(db: pg.Pool, seed: Seed): Promise<void> {
  await withTx(db, async (tx) => {
    const ids = new Map<string, number>();
    for (const part of chunks(seed.employees)) {
      const { rows } = await tx.query(
        `INSERT INTO employees (code, first_name, last_name, gender, work_email, hire_date, leave_date, leave_reason)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::date[], $7::date[], $8::text[])
         RETURNING id, code`,
        [
          part.map((e) => e.code), part.map((e) => e.firstName), part.map((e) => e.lastName), part.map((e) => e.gender),
          part.map((e) => e.workEmail), part.map((e) => e.hireDate), part.map((e) => e.leaveDate), part.map((e) => e.leaveReason),
        ],
      );
      for (const r of rows) ids.set(r.code, r.id);
    }
    const id = (code: string | null) => (code === null ? null : ids.get(code)!);
    for (const part of chunks(seed.changes)) {
      await tx.query(
        `INSERT INTO job_changes (employee_id, effective_date, country, department, role, level, manager_set, manager_id, salary, currency, note)
         SELECT * FROM unnest($1::int[], $2::date[], $3::text[], $4::text[], $5::text[], $6::smallint[], $7::boolean[], $8::int[], $9::bigint[], $10::text[], $11::text[])`,
        [
          part.map((c) => id(c.code)), part.map((c) => c.effectiveDate), part.map((c) => c.country), part.map((c) => c.department),
          part.map((c) => c.role), part.map((c) => c.level), part.map((c) => c.managerSet), part.map((c) => id(c.managerCode)),
          part.map((c) => c.salary), part.map((c) => c.currency), part.map((c) => c.note),
        ],
      );
    }
    for (const part of chunks(seed.leaveEvents)) {
      await tx.query(
        `INSERT INTO leave_events (employee_id, kind, leave_date, reason)
         SELECT * FROM unnest($1::int[], $2::text[], $3::date[], $4::text[])`,
        [part.map((e) => id(e.code)), part.map((e) => e.kind), part.map((e) => e.leaveDate), part.map((e) => e.reason)],
      );
    }
  });
}
