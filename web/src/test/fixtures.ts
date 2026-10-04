/** A list response as GET /api/employees returns it. */
export const listResponse = (over: Partial<{ rows: unknown[]; total: number; stats: unknown[] }> = {}) => ({
  rows: [
    { code: 'E000123', firstName: 'Ana', lastName: 'Silva', country: 'BR', currency: 'BRL', department: 'Engineering', role: 'Software Engineer',
      level: 3, salary: 133000, hireDate: '2024-02-29', leaveDate: null, status: 'active' },
    { code: 'E000456', firstName: 'Kenji', lastName: 'Sato', country: 'JP', currency: 'JPY', department: 'Sales', role: 'Account Executive',
      level: 4, salary: 6070000, hireDate: '2026-12-01', leaveDate: null, status: 'starting' },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
  stats: [
    { currency: 'BRL', median: 133000, min: 133000, max: 133000, headcount: 1 },
    { currency: 'JPY', median: 6070000, min: 6070000, max: 6070000, headcount: 1 },
  ],
  ...over,
});
