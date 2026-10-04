import type { Response } from 'express';

/** 400 with one plain message per field: { error, fields: { field: message } }. */
export function fieldErrors(res: Response, issues: { path: PropertyKey[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  res.status(400).json({ error: 'Some fields need fixing.', fields });
}
