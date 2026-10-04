import { CURRENCY, employeeCreateSchema, MSG, type Country } from '@acme/shared';
import { parse } from 'csv-parse/sync';
import type pg from 'pg';

export type Problem = { line: number; column: string; message: string };
export type ImportRow = {
  line: number; code: string; firstName: string; lastName: string; gender: string; workEmail: string; country: string;
  currency: string; department: string; role: string; level: number; salary: number; hireDate: string; managerCode: string | null;
};

const REQUIRED = ['code', 'first_name', 'last_name', 'gender', 'work_email', 'country', 'department', 'role', 'level', 'salary', 'hire_date'];
const OPTIONAL = ['manager_code', 'currency', 'status', 'leave_date', 'leave_reason'];
const COLUMN_OF: Record<string, string> = {
  code: 'code', firstName: 'first_name', lastName: 'last_name', gender: 'gender', workEmail: 'work_email', country: 'country',
  department: 'department', role: 'role', level: 'level', salary: 'salary', hireDate: 'hire_date', managerCode: 'manager_code',
};

type Record_ = { line: number; values: Record<string, string> };

/** Splits the file into header-keyed records with their starting file line. */
function readCsv(text: string): { records: Record_[]; problems: Problem[] } {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const parsed = parse(body, { delimiter, skip_empty_lines: true, info: true, raw: true, relax_column_count: true }) as unknown as {
    record: string[]; info: { lines: number }; raw: string;
  }[];
  const [header, ...rest] = parsed;
  const columns = header!.record.map((c) => c.trim().toLowerCase());
  const records = rest.map(({ record, info, raw }) => {
    const line = info.lines - (raw.replace(/\r?\n$/, '').match(/\n/g)?.length ?? 0);
    const values: Record<string, string> = {};
    columns.forEach((c, i) => (values[c] = (record[i] ?? '').trim()));
    return { line, values };
  });
  return { records, problems: [] };
}

/** Undo the export's formula guard: "'=x" → "=x". */
const unguard = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/** Checks a CSV of new employees against every rule; returns the rows as they would be saved and all problems. */
export async function checkImport(_db: pg.Pool | pg.PoolClient, text: string): Promise<{ rows: ImportRow[]; problems: Problem[] }> {
  const { records, problems } = readCsv(text);
  const rows: ImportRow[] = [];
  for (const { line, values } of records) {
    const v = (c: string) => unguard(values[c] ?? '');
    const input = {
      code: v('code'), firstName: v('first_name'), lastName: v('last_name'), gender: v('gender'), workEmail: v('work_email'),
      country: v('country'), department: v('department'), role: v('role'), level: Number(v('level').replace(/^L/i, '')),
      salary: v('salary'), hireDate: v('hire_date'), managerCode: v('manager_code') || null,
    };
    const parsed = employeeCreateSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push({ line, column: COLUMN_OF[String(issue.path[0])] ?? 'row', message: issue.message });
      continue;
    }
    const e = parsed.data;
    const currency = CURRENCY[e.country as Country];
    const before = problems.length;
    if (v('currency') && v('currency') !== currency) problems.push({ line, column: 'currency', message: MSG.importCurrency(currency, e.country) });
    for (const c of ['status', 'leave_date', 'leave_reason']) if (v(c)) problems.push({ line, column: c, message: MSG.importLeaveEmpty });
    if (problems.length > before) continue;
    rows.push({ line, ...e, currency: CURRENCY[e.country as Country], managerCode: e.managerCode ?? null });
  }
  return { rows, problems };
}
