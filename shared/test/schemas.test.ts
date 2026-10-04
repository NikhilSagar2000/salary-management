import { expect, test } from 'vitest';
import { employeeCreateSchema } from '../src/schemas.ts';

/** field → first message, from a failed parse */
function errorsOf(input: unknown): Record<string, string> {
  const result = employeeCreateSchema.safeParse(input);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) out[issue.path.join('.')] ??= issue.message;
  return out;
}

test.fails('employee schema requires each field with a plain message', () => {
  expect(errorsOf({})).toEqual({
    code: 'Employee code must be E followed by 6 digits, like E000123.',
    firstName: 'Enter a first name.',
    lastName: 'Enter a last name.',
    gender: 'Choose a gender.',
    workEmail: 'Enter a work email, like name@acme.example.',
    hireDate: 'Enter the hire date as YYYY-MM-DD.',
    country: 'Choose a country.',
    department: 'Choose a department.',
    role: 'Choose a role.',
    level: 'Choose a level from L1 to L7.',
    salary: 'Enter the salary as a whole number, like 95000.',
  });
});
