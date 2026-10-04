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

test('employee schema requires each field with a plain message', () => {
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

const valid = {
  code: 'E000123', firstName: 'Ana', lastName: 'Silva', gender: 'female', workEmail: 'ana.silva@acme.example',
  hireDate: '2024-02-29', country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 3, salary: 133000,
};

test('role must belong to the department and the level be allowed', () => {
  expect(errorsOf(valid)).toEqual({});
  expect(errorsOf({ ...valid, department: 'Sales' })).toEqual({ role: "Software Engineer isn't a role in Sales." });
  expect(errorsOf({ ...valid, department: 'Sales', role: 'Sales Development Representative', level: 5 })).toEqual({
    level: 'Sales Development Representative goes from L1 to L3.',
  });
});

test.fails('salary accepts only whole numbers from 1 to the maximum, with a plain message for separators, decimals, negatives and exponents', () => {
  const cases: [unknown, number | string][] = [
    [95000, 95000],
    ['95000', 95000],
    [' 95000 ', 95000],
    [10_000_000_000, 10_000_000_000],
    ['95,000', 'Write the salary without separators, like 95000.'],
    ['95.000', 'Write the salary without separators, like 95000.'],
    ['95000.50', 'Salary must be a whole number, like 95000.'],
    [95000.5, 'Salary must be a whole number, like 95000.'],
    [-1, 'Salary must be more than 0.'],
    [0, 'Salary must be more than 0.'],
    ['1e6', 'Enter the salary as a whole number, like 95000.'],
    ['', 'Enter the salary as a whole number, like 95000.'],
    [null, 'Enter the salary as a whole number, like 95000.'],
    [10_000_000_001, 'That salary is too large. The most allowed is 10,000,000,000.'],
  ];
  for (const [input, want] of cases) {
    const result = employeeCreateSchema.safeParse({ ...valid, salary: input });
    const got = result.success ? result.data.salary : errorsOf({ ...valid, salary: input }).salary;
    expect(got, `salary ${JSON.stringify(input)}`).toBe(want);
  }
});
