import { z } from 'zod';
import { MSG } from './messages.ts';
import { COUNTRIES, DEPARTMENTS, GENDERS, ROLE_NAMES } from './reference.ts';

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
});
export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;
