export const CURRENCY = { US: 'USD', IN: 'INR', GB: 'GBP', DE: 'EUR', BR: 'BRL', JP: 'JPY' } as const;
export type Country = keyof typeof CURRENCY;
export type Currency = (typeof CURRENCY)[Country];
export const COUNTRIES = Object.keys(CURRENCY) as Country[];
export const COUNTRY_NAMES: Record<Country, string> = {
  US: 'United States', IN: 'India', GB: 'United Kingdom', DE: 'Germany', BR: 'Brazil', JP: 'Japan',
};

export const GENDERS = ['female', 'male', 'non_binary'] as const;
export type Gender = (typeof GENDERS)[number];

export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Customer Support', 'Finance', 'HR', 'Operations',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Each role, its department and the levels it can be held at (docs/SPEC.md, Reference data). */
export const ROLES = {
  'Software Engineer': { department: 'Engineering', minLevel: 1, maxLevel: 7 },
  'Data Engineer': { department: 'Engineering', minLevel: 1, maxLevel: 6 },
  'QA Engineer': { department: 'Engineering', minLevel: 1, maxLevel: 5 },
  'Engineering Manager': { department: 'Engineering', minLevel: 5, maxLevel: 7 },
  'Product Manager': { department: 'Product', minLevel: 2, maxLevel: 7 },
  'Product Designer': { department: 'Design', minLevel: 1, maxLevel: 6 },
  'Sales Development Representative': { department: 'Sales', minLevel: 1, maxLevel: 3 },
  'Account Executive': { department: 'Sales', minLevel: 2, maxLevel: 6 },
  'Sales Manager': { department: 'Sales', minLevel: 5, maxLevel: 7 },
  'Marketing Specialist': { department: 'Marketing', minLevel: 1, maxLevel: 4 },
  'Marketing Manager': { department: 'Marketing', minLevel: 4, maxLevel: 7 },
  'Support Specialist': { department: 'Customer Support', minLevel: 1, maxLevel: 4 },
  'Support Manager': { department: 'Customer Support', minLevel: 4, maxLevel: 6 },
  'Accountant': { department: 'Finance', minLevel: 1, maxLevel: 5 },
  'Financial Analyst': { department: 'Finance', minLevel: 1, maxLevel: 6 },
  'HR Generalist': { department: 'HR', minLevel: 1, maxLevel: 5 },
  'Recruiter': { department: 'HR', minLevel: 1, maxLevel: 5 },
  'Operations Analyst': { department: 'Operations', minLevel: 1, maxLevel: 5 },
  'IT Support Specialist': { department: 'Operations', minLevel: 1, maxLevel: 4 },
} as const satisfies Record<string, { department: Department; minLevel: number; maxLevel: number }>;
export type Role = keyof typeof ROLES;
export const ROLE_NAMES = Object.keys(ROLES) as Role[];

export const MAX_SALARY = 10_000_000_000;

export const STATUSES = ['starting', 'active', 'leaving', 'left'] as const;
export type Status = (typeof STATUSES)[number];

export const SORTS = ['name', 'code', 'country', 'department', 'role', 'level', 'hireDate', 'salary'] as const;
export type Sort = (typeof SORTS)[number];
