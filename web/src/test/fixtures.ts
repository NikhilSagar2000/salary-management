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

const brl = (amount: number) => ({ amount, currency: 'BRL' });

/** An employee page response as GET /api/employees/:code returns it. */
export const detailResponse = (over: Record<string, unknown> = {}) => ({
  code: 'E000123', firstName: 'Ana', lastName: 'Silva', gender: 'female', workEmail: 'ana.silva@acme.example',
  hireDate: '2024-02-29', leaveDate: null, leaveReason: null, status: 'active', version: 4,
  current: {
    country: 'BR', currency: 'BRL', department: 'Engineering', role: 'Software Engineer', level: 4, salary: 145000,
    manager: { code: 'E000200', name: 'Bruno Lima', hasLeft: true },
  },
  peers: { currency: 'BRL', median: 129000, min: 98000, max: 170000, headcount: 48, position: 12 },
  reports: [{ code: 'E000301', name: 'Carla Souza' }],
  timeline: [
    { type: 'change', id: 1, date: '2024-02-29', hire: true, note: null, scheduled: false, cancelled: false, wontApply: false,
      changes: [{ field: 'country', from: null, to: 'BR' }, { field: 'level', from: null, to: 3 }, { field: 'salary', from: null, to: brl(133000) }] },
    { type: 'change', id: 2, date: '2025-04-01', hire: false, note: 'Promotion to L4', scheduled: false, cancelled: false, wontApply: false,
      changes: [{ field: 'level', from: 3, to: 4 }, { field: 'salary', from: brl(133000), to: brl(145000) }] },
    { type: 'change', id: 3, date: '2027-01-01', hire: false, note: null, scheduled: true, cancelled: false, wontApply: false,
      changes: [{ field: 'salary', from: brl(145000), to: brl(150000) }] },
    { type: 'change', id: 4, date: '2027-02-01', hire: false, note: null, scheduled: true, cancelled: true, wontApply: false,
      changes: [{ field: 'manager', from: { code: 'E000200', name: 'Bruno Lima' }, to: null }] },
  ],
  ...over,
});
