import { z } from 'zod';
import { MSG } from './messages.ts';
import { COUNTRIES, DEPARTMENTS, GENDERS, LEVELS, MAX_SALARY, ROLE_NAMES, ROLES, SORTS, STATUSES, type Role, type Status } from './reference.ts';

/** A salary typed by a person (number or text) → whole number, or a plain message. */
export const salarySchema = z.unknown().transform((value, ctx) => {
  const fail = (message: string) => {
    ctx.addIssue({ code: 'custom', message });
    return z.NEVER;
  };
  let n: number;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return fail(MSG.salarySeparators);
    if (/^-?\d+[.,]\d+$/.test(s)) return fail(MSG.salaryWhole);
    if (!/^-?\d+$/.test(s)) return fail(MSG.salary);
    n = Number(s);
  } else return fail(MSG.salary);
  if (!Number.isFinite(n)) return fail(MSG.salary);
  if (!Number.isInteger(n)) return fail(MSG.salaryWhole);
  if (n <= 0) return fail(MSG.salaryPositive);
  if (n > MAX_SALARY) return fail(MSG.salaryTooLarge);
  return n;
});

/** A real calendar date written YYYY-MM-DD; `field` names it in the message. */
export const isoDate = (field: string) =>
  z.string({ error: MSG.date(field) }).refine((s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
    return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
  }, { error: MSG.date(field) });

/** A manager's employee code; null means no manager. */
const managerCode = z.string({ error: MSG.managerCode }).regex(/^E\d{6}$/, { error: MSG.managerCode }).nullable().optional();

const text = (message: string) => z.string({ error: message }).trim().min(1, { error: message }).max(100);

export const employeeCreateSchema = z.object({
  code: z.string({ error: MSG.code }).regex(/^E\d{6}$/, { error: MSG.code }),
  firstName: text(MSG.firstName),
  lastName: text(MSG.lastName),
  gender: z.enum(GENDERS, { error: MSG.gender }),
  workEmail: z.email({ error: MSG.workEmail }),
  hireDate: isoDate('hire date'),
  country: z.enum(COUNTRIES, { error: MSG.country }),
  department: z.enum(DEPARTMENTS, { error: MSG.department }),
  role: z.enum(ROLE_NAMES, { error: MSG.role }),
  level: z.number({ error: MSG.level }).int({ error: MSG.level }).min(1, { error: MSG.level }).max(7, { error: MSG.level }),
  salary: salarySchema,
  managerCode,
}).superRefine((job, ctx) => {
  for (const issue of jobProblems(job)) ctx.addIssue({ code: 'custom', ...issue });
});
export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;

/** Problems with a department + role + level combination (used for new employees and job changes). */
export function jobProblems(job: { department: string; role: string; level: number }) {
  const rule = ROLES[job.role as Role];
  // An unknown role or a level outside L1–L7 already has its own message.
  if (!rule || !Number.isInteger(job.level) || job.level < 1 || job.level > 7) return [];
  if (rule.department !== job.department) {
    return [{ path: ['role'], message: MSG.roleNotInDepartment(job.role, job.department) }];
  }
  if (job.level < rule.minLevel || job.level > rule.maxLevel) {
    return [{ path: ['level'], message: MSG.levelOutOfRange(job.role, rule.minLevel, rule.maxLevel) }];
  }
  return [];
}

/** Editing personal details in place; `version` is the one the page loaded (EMP-13). */
export const employeeDetailsSchema = z.object({
  version: z.number().int().positive(),
  firstName: text(MSG.firstName).optional(),
  lastName: text(MSG.lastName).optional(),
  gender: z.enum(GENDERS, { error: MSG.gender }).optional(),
  workEmail: z.email({ error: MSG.workEmail }).optional(),
});
export type EmployeeDetails = z.infer<typeof employeeDetailsSchema>;

/** A dated job change: only the fields given change (D47). */
export const jobChangeSchema = z.object({
  version: z.number().int().positive(),
  effectiveDate: isoDate('effective date'),
  country: z.enum(COUNTRIES, { error: MSG.country }).optional(),
  department: z.enum(DEPARTMENTS, { error: MSG.department }).optional(),
  role: z.enum(ROLE_NAMES, { error: MSG.role }).optional(),
  level: z.number({ error: MSG.level }).int({ error: MSG.level }).min(1, { error: MSG.level }).max(7, { error: MSG.level }).optional(),
  salary: salarySchema.optional(),
  managerCode,
  note: z.string().trim().max(500).optional(),
}).superRefine((c, ctx) => {
  const changes = [c.country, c.department, c.role, c.level, c.salary, c.managerCode].some((v) => v !== undefined);
  if (!changes) ctx.addIssue({ code: 'custom', path: [], message: MSG.changeNothing });
  if (c.country !== undefined && c.salary === undefined) ctx.addIssue({ code: 'custom', path: ['salary'], message: MSG.moveNeedsSalary });
});
export type JobChange = z.infer<typeof jobChangeSchema>;

/** Marking someone as leaving or left (LEAVE-1). */
export const leaveSchema = z.object({
  version: z.number().int().positive(),
  leaveDate: isoDate('leave date'),
  reason: z.string().trim().max(500, { error: MSG.reasonTooLong }).optional(),
});
export type Leave = z.infer<typeof leaveSchema>;

/** A comma-separated list in the URL, each value one of `allowed`; unknown values are named in the message. */
function csvOf<T extends string | number>(allowed: readonly T[], label: string) {
  return z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return undefined;
      const values = s.split(',').map((v) => v.trim()).filter(Boolean);
      const out: T[] = [];
      for (const v of values) {
        const match = allowed.find((a) => String(a) === v);
        if (match === undefined) {
          ctx.addIssue({ code: 'custom', message: MSG.unknownValue(label, v) });
          return z.NEVER;
        }
        out.push(match);
      }
      return out.length ? out : undefined;
    });
}

/** The list shows everyone except people who have left, unless asked (LEAVE-6). */
export const DEFAULT_STATUSES: Status[] = ['starting', 'active', 'leaving'];

/** Employee list query (URL state): filters, sort and paging. */
export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional().transform((s) => s || undefined),
  country: csvOf(COUNTRIES, 'country'),
  department: csvOf(DEPARTMENTS, 'department'),
  role: csvOf(ROLE_NAMES, 'role'),
  level: csvOf(LEVELS, 'level'),
  gender: csvOf(GENDERS, 'gender'),
  status: csvOf(STATUSES, 'status').transform((s) => s ?? DEFAULT_STATUSES),
  sort: z.enum(SORTS, { error: (i) => MSG.unknownValue('sort', String(i.input)) }).default('name'),
  dir: z.enum(['asc', 'desc'], { error: (i) => MSG.unknownValue('sort direction', String(i.input)) }).default('asc'),
  salaryMin: salarySchema.optional(),
  salaryMax: salarySchema.optional(),
  page: z.string().optional().transform((s, ctx) => {
    if (s === undefined) return 1;
    if (!/^\d+$/.test(s) || Number(s) < 1) {
      ctx.addIssue({ code: 'custom', message: MSG.page(s) });
      return z.NEVER;
    }
    return Number(s);
  }),
  pageSize: z.string().optional().transform((s, ctx) => {
    if (s === undefined) return 25;
    if (s !== '25' && s !== '50' && s !== '100') {
      ctx.addIssue({ code: 'custom', message: MSG.pageSize(s) });
      return z.NEVER;
    }
    return Number(s) as 25 | 50 | 100;
  }),
}).superRefine((q, ctx) => {
  const usesSalary = q.sort === 'salary' || q.salaryMin !== undefined || q.salaryMax !== undefined;
  if (usesSalary && q.country?.length !== 1) ctx.addIssue({ code: 'custom', path: ['country'], message: MSG.salaryNeedsOneCountry });
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Pay overview query: one country at a time. */
export const overviewQuerySchema = z.object({ country: z.enum(COUNTRIES, { error: MSG.country }) });
