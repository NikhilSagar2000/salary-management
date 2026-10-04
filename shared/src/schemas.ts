import { z } from 'zod';
import { MSG } from './messages.ts';
import { COUNTRIES, DEPARTMENTS, GENDERS, ROLE_NAMES, ROLES, type Role } from './reference.ts';

const text = (message: string) => z.string({ error: message }).trim().min(1, { error: message }).max(100);

export const employeeCreateSchema = z.object({
  code: z.string({ error: MSG.code }).regex(/^E\d{6}$/, { error: MSG.code }),
  firstName: text(MSG.firstName),
  lastName: text(MSG.lastName),
  gender: z.enum(GENDERS, { error: MSG.gender }),
  workEmail: z.email({ error: MSG.workEmail }),
  hireDate: z.string({ error: MSG.date('hire date') }),
  country: z.enum(COUNTRIES, { error: MSG.country }),
  department: z.enum(DEPARTMENTS, { error: MSG.department }),
  role: z.enum(ROLE_NAMES, { error: MSG.role }),
  level: z.number({ error: MSG.level }).int({ error: MSG.level }).min(1, { error: MSG.level }).max(7, { error: MSG.level }),
  salary: z.number({ error: MSG.salary }),
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
