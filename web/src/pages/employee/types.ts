import type { Currency } from '@acme/shared';

export type Money = { amount: number; currency: Currency };
export type Person = { code: string; name: string };
export type Change = {
  type: 'change'; id: number; date: string; hire: boolean; note: string | null; scheduled: boolean; cancelled: boolean; cancelledOn: string | null; wontApply: boolean;
  changes: { field: string; from: unknown; to: unknown }[];
};
export type LeaveEvent = { type: 'left'; date: string; reason: string | null; scheduled: boolean; undone: boolean } | { type: 'undone'; date: string };
export type Detail = {
  code: string; firstName: string; lastName: string; gender: string; workEmail: string; hireDate: string;
  leaveDate: string | null; leaveReason: string | null; status: 'starting' | 'active' | 'leaving' | 'left'; version: number;
  current: { country: string; currency: Currency; department: string; role: string; level: number; salary: number; manager: (Person & { hasLeft: boolean }) | null };
  peers: { currency: Currency; median: number; min: number; max: number; headcount: number; position: number } | null;
  reports: Person[];
  timeline: (Change | LeaveEvent)[];
};
