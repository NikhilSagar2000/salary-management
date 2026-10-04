import { CURRENCY, employeeCreateSchema, formatDate, MSG, type Country } from '@acme/shared';
import type pg from 'pg';

const MAX_ROWS = 10_000;

/** `line` 0 with an empty `column` means a problem with the whole file. */
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


/**
 * RFC 4180 CSV: quoted fields may hold the delimiter, line breaks and doubled quotes; CRLF, LF or CR line ends;
 * empty lines skipped. Each record keeps the file line it starts on. An unclosed quote is an error.
 */
export function parseCsv(text: string, delimiter: string): { records: { line: number; cells: string[] }[]; error?: string } {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let line = 1;
  let start = 1;
  let quotedFrom = 0;
  const endRecord = () => {
    cells.push(cell);
    if (cells.length > 1 || cells[0] !== '') records.push({ line: start, cells });
    cells = [];
    cell = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quotedFrom) {
      if (ch === '"' && text[i + 1] === '"') cell += text[i++];
      else if (ch === '"') quotedFrom = 0;
      else {
        if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++;
        cell += ch;
      }
    } else if (ch === '"' && cell === '') quotedFrom = line;
    else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      start = ++line;
    } else cell += ch;
  }
  if (quotedFrom) return { records, error: MSG.importUnclosedQuote(quotedFrom) };
  endRecord();
  return { records };
}

type Record_ = { line: number; values: Record<string, string> };

/** Splits the file into header-keyed records with their starting file line. */
function readCsv(text: string): { records: Record_[]; problems: Problem[] } {
  const body = text.replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const { records: parsed, error } = parseCsv(body, delimiter);
  if (error) return { records: [], problems: [{ line: 0, column: '', message: error }] };
  const [header, ...rest] = parsed;
  const columns = (header?.cells ?? []).map((c) => c.trim().toLowerCase());
  const records = rest.map(({ line, cells }) => {
    const values: Record<string, string> = {};
    columns.forEach((c, i) => (values[c] = (cells[i] ?? '').trim()));
    return { line, values };
  });
  return { records, problems: [] };
}

/** Undo the export's formula guard: "'=x" → "=x". */
const unguard = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/** Checks a CSV of new employees against every rule; returns the rows as they would be saved and all problems. */
export async function checkImport(db: pg.Pool | pg.PoolClient, text: string): Promise<{ rows: ImportRow[]; problems: Problem[] }> {
  const { records, problems } = readCsv(text);
  const rows: ImportRow[] = [];
  if (records.length > MAX_ROWS) return { rows, problems: [{ line: 0, column: '', message: MSG.importTooManyRows(records.length) }] };
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
  const later = [...(await checkDuplicates(db, rows)), ...(await checkManagers(db, rows))];
  problems.push(...later);
  const bad = new Set(later.map((p) => p.line));
  return { rows: rows.filter((r) => !bad.has(r.line)), problems: problems.sort((a, b) => a.line - b.line) };
}

/** CSV-6: a code or work email already in the database, or repeated in the file, is a problem on every row involved. */
async function checkDuplicates(db: pg.Pool | pg.PoolClient, rows: ImportRow[]): Promise<Problem[]> {
  const email = (r: ImportRow) => r.workEmail.toLowerCase();
  const { rows: taken } = await db.query(
    'SELECT code, lower(work_email) AS email FROM employees WHERE code = ANY($1) OR lower(work_email) = ANY($2)',
    [rows.map((r) => r.code), rows.map(email)],
  );
  const takenCodes = new Set(taken.map((t) => t.code));
  const takenEmails = new Set(taken.map((t) => t.email));
  const linesOf = (key: (r: ImportRow) => string) => {
    const lines = new Map<string, number[]>();
    for (const r of rows) lines.set(key(r), [...(lines.get(key(r)) ?? []), r.line]);
    return lines;
  };
  const codeLines = linesOf((r) => r.code);
  const emailLines = linesOf(email);
  const problems: Problem[] = [];
  for (const r of rows) {
    if (takenCodes.has(r.code)) problems.push({ line: r.line, column: 'code', message: MSG.codeUsed(r.code) });
    else if (codeLines.get(r.code)!.length > 1) problems.push({ line: r.line, column: 'code', message: MSG.importDuplicate(r.code, codeLines.get(r.code)!) });
    if (takenEmails.has(email(r))) problems.push({ line: r.line, column: 'work_email', message: MSG.emailUsed });
    else if (emailLines.get(email(r))!.length > 1) {
      problems.push({ line: r.line, column: 'work_email', message: MSG.importDuplicate(email(r), emailLines.get(email(r))!) });
    }
  }
  return problems;
}

/** CSV-5: a manager is an employee in the database or a row in this file, employed on the row's hire date, and not the person. */
async function checkManagers(db: pg.Pool | pg.PoolClient, rows: ImportRow[]): Promise<Problem[]> {
  const codes = [...new Set(rows.map((r) => r.managerCode).filter((c): c is string => c !== null))];
  const { rows: found } = await db.query(
    'SELECT code, first_name, last_name, hire_date, leave_date FROM employees WHERE code = ANY($1)',
    [codes],
  );
  type Manager = { name: string; hireDate: string; leaveDate: string | null };
  const managers = new Map<string, Manager>(
    rows.map((r) => [r.code, { name: `${r.firstName} ${r.lastName}`, hireDate: r.hireDate, leaveDate: null }]),
  );
  for (const m of found) managers.set(m.code, { name: `${m.first_name} ${m.last_name}`, hireDate: m.hire_date, leaveDate: m.leave_date });
  const problems: Problem[] = [];
  for (const r of rows) {
    if (r.managerCode === null) continue;
    const m = managers.get(r.managerCode);
    const problem = (message: string) => problems.push({ line: r.line, column: 'manager_code', message });
    if (r.managerCode === r.code) problem(MSG.ownManager);
    else if (!m) problem(MSG.noEmployee(r.managerCode));
    else if (m.hireDate > r.hireDate || (m.leaveDate && m.leaveDate <= r.hireDate)) problem(MSG.managerNotEmployed(m.name, formatDate(r.hireDate)));
  }
  return problems;
}
