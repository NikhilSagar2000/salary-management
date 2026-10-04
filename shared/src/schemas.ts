import { z } from 'zod';
import { MSG } from './messages.ts';
import { COUNTRIES, DEPARTMENTS, GENDERS, MAX_SALARY, ROLE_NAMES, ROLES, type Role } from './reference.ts';

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
  if (!rule) return [];
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
