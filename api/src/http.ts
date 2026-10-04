import { MSG } from '@acme/shared';
import type { Response } from 'express';
import type pg from 'pg';

type Issue = { path: PropertyKey[]; message: string };
const fieldsOf = (issues: Issue[]) => {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
};

/** 400 with one plain message per field: { error, fields: { field: message } }. */
export function fieldErrors(res: Response, issues: Issue[]) {
  sendFieldErrors(res, fieldsOf(issues));
}

/** 400 for a bad address (list, export, overview): no form to show messages beside, so `error` is the messages themselves. */
export function queryErrors(res: Response, issues: Issue[]) {
  const fields = fieldsOf(issues);
  res.status(400).json({ error: [...new Set(Object.values(fields))].join(' '), fields });
}

export function sendFieldErrors(res: Response, fields: Record<string, string>) {
  res.status(400).json({ error: MSG.fixFields, fields });
}

/** After a write matched no row: 404 if the employee doesn't exist, else 409 (out-of-date version). */
export async function sendStaleOrMissing(res: Response, db: pg.Pool, code: string) {
  const { rowCount } = await db.query('SELECT 1 FROM employees WHERE code = $1', [code]);
  if (rowCount) res.status(409).json({ error: MSG.stale });
  else res.status(404).json({ error: MSG.noEmployee(code) });
}

/** Thrown inside a write to refuse it with plain field messages (400); the transaction rolls back. */
export class FieldProblem extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super(Object.values(fields).join(' '));
    this.fields = fields;
  }
}
