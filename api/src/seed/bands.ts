// Seed pay data, copied from docs/research/pay-bands.md (all seed values there are ESTIMATED from
// cited CONFIRMED inputs). Amounts are annual base salary in each country's own currency.
import type { Country, Department, Role } from '@acme/shared';

/** Median annual base at L3 (mid level) per role (research §1). Engineering Manager is an L5 value. */
export const L3: Record<Country, Record<Role, number>> = {
  US: {
    'Software Engineer': 131000,
    'Data Engineer': 133000,
    'QA Engineer': 107000,
    'Engineering Manager': 187000,
    'Product Manager': 143000,
    'Product Designer': 129000,
    'Sales Development Representative': 56000,
    'Account Executive': 88000,
    'Sales Manager': 87000,
    'Marketing Specialist': 79000,
    'Marketing Manager': 93000,
    'Support Specialist': 72000,
    'Support Manager': 93000,
    Accountant: 79000,
    'Financial Analyst': 95000,
    'HR Generalist': 82000,
    Recruiter: 83000,
    'Operations Analyst': 89000,
    'IT Support Specialist': 74000,
  },
  IN: {
    'Software Engineer': 1550000,
    'Data Engineer': 1730000,
    'QA Engineer': 920000,
    'Engineering Manager': 5290000,
    'Product Manager': 2770000,
    'Product Designer': 1620000,
    'Sales Development Representative': 670000,
    'Account Executive': 830000,
    'Sales Manager': 780000,
    'Marketing Specialist': 1060000,
    'Marketing Manager': 1140000,
    'Support Specialist': 620000,
    'Support Manager': 810000,
    Accountant: 480000,
    'Financial Analyst': 930000,
    'HR Generalist': 710000,
    Recruiter: 760000,
    'Operations Analyst': 820000,
    'IT Support Specialist': 780000,
  },
  GB: {
    'Software Engineer': 59000,
    'Data Engineer': 67000,
    'QA Engineer': 49000,
    'Engineering Manager': 98000,
    'Product Manager': 77000,
    'Product Designer': 50000,
    'Sales Development Representative': 35000,
    'Account Executive': 38000,
    'Sales Manager': 41000,
    'Marketing Specialist': 43000,
    'Marketing Manager': 50000,
    'Support Specialist': 40000,
    'Support Manager': 46000,
    Accountant: 44000,
    'Financial Analyst': 50000,
    'HR Generalist': 43000,
    Recruiter: 42000,
    'Operations Analyst': 46000,
    'IT Support Specialist': 41000,
  },
  DE: {
    'Software Engineer': 72000,
    'Data Engineer': 74000,
    'QA Engineer': 62000,
    'Engineering Manager': 104000,
    'Product Manager': 76000,
    'Product Designer': 65000,
    'Sales Development Representative': 57000,
    'Account Executive': 65000,
    'Sales Manager': 74000,
    'Marketing Specialist': 53000,
    'Marketing Manager': 60000,
    'Support Specialist': 44000,
    'Support Manager': 53000,
    Accountant: 50000,
    'Financial Analyst': 69000,
    'HR Generalist': 56000,
    Recruiter: 52000,
    'Operations Analyst': 61000,
    'IT Support Specialist': 54000,
  },
  BR: {
    'Software Engineer': 133000,
    'Data Engineer': 150000,
    'QA Engineer': 102000,
    'Engineering Manager': 285000,
    'Product Manager': 171000,
    'Product Designer': 126000,
    'Sales Development Representative': 72000,
    'Account Executive': 97000,
    'Sales Manager': 82000,
    'Marketing Specialist': 80000,
    'Marketing Manager': 115000,
    'Support Specialist': 62000,
    'Support Manager': 91000,
    Accountant: 77000,
    'Financial Analyst': 85000,
    'HR Generalist': 75000,
    Recruiter: 75000,
    'Operations Analyst': 80000,
    'IT Support Specialist': 57000,
  },
  JP: {
    'Software Engineer': 6070000,
    'Data Engineer': 6400000,
    'QA Engineer': 5060000,
    'Engineering Manager': 9140000,
    'Product Manager': 6930000,
    'Product Designer': 5520000,
    'Sales Development Representative': 3540000,
    'Account Executive': 4410000,
    'Sales Manager': 4120000,
    'Marketing Specialist': 4140000,
    'Marketing Manager': 4830000,
    'Support Specialist': 3680000,
    'Support Manager': 4490000,
    Accountant: 4110000,
    'Financial Analyst': 5040000,
    'HR Generalist': 4290000,
    Recruiter: 4170000,
    'Operations Analyst': 4430000,
    'IT Support Specialist': 4040000,
  },
};

/** Level multipliers relative to L3, L1…L7 (research §2, "use" rows). */
export const MULTIPLIER: Record<Country, { tech: number[]; other: number[] }> = {
  US: { tech: [0.79, 0.93, 1.0, 1.29, 1.46, 1.57, 1.72], other: [0.82, 0.94, 1.0, 1.3, 1.36, 1.72, 1.8] },
  IN: { tech: [0.46, 0.75, 1.0, 1.6, 2.87, 3.54, 4.65], other: [0.57, 0.82, 1.0, 1.8, 1.89, 3.78, 7.08] },
  GB: { tech: [0.66, 0.9, 1.0, 1.39, 1.72, 1.81, 2.14], other: [0.74, 0.91, 1.0, 1.27, 1.34, 1.74, 2.42] },
  DE: { tech: [0.78, 0.92, 1.0, 1.24, 1.46, 1.53, 1.95], other: [0.74, 0.95, 1.0, 1.36, 1.42, 1.49, 2.2] },
  BR: { tech: [0.56, 0.75, 1.0, 1.79, 2.31, 2.46, 3.02], other: [0.56, 0.75, 1.0, 1.79, 2.31, 2.46, 3.02] },
  JP: { tech: [0.87, 0.93, 1.0, 1.12, 1.43, 1.89, 2.28], other: [0.87, 0.93, 1.0, 1.12, 1.43, 1.89, 2.28] },
};

/** Market p25 and p75 as a fraction of the median, per country (research §3). */
export const MARKET_SPREAD: Record<Country, { p25: number; p75: number }> = {
  US: { p25: 0.85, p75: 1.16 },
  IN: { p25: 0.71, p75: 1.39 },
  GB: { p25: 0.83, p75: 1.2 },
  DE: { p25: 0.87, p75: 1.15 },
  BR: { p25: 0.78, p75: 1.27 },
  JP: { p25: 0.85, p75: 1.16 },
};

/** Same-job gap for women and non-binary staff (D61): US, DE, JP from research §4; GB, BR, IN estimated. */
export const SAME_JOB_GAP: Record<Country, number> = { US: 0.01, IN: 0.08, GB: 0.04, DE: 0.06, BR: 0.06, JP: 0.12 };

const TECH: Department[] = ['Engineering', 'Product', 'Design'];

/** The researched median for a role and level in a country (D59). */
export function band(country: Country, role: Role, department: Department, level: number): number {
  const m = MULTIPLIER[country][TECH.includes(department) ? 'tech' : 'other'];
  const anchor = role === 'Engineering Manager' ? L3[country][role] / m[4]! : L3[country][role];
  return anchor * m[level - 1]!;
}
