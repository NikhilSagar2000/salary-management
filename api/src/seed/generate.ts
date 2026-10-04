export const SEED_ANCHOR = '2026-09-30';
export type Seed = { employees: unknown[]; changes: unknown[]; leaveEvents: unknown[]; outliers: string[] };
export function generateSeed(): Seed {
  return { employees: [], changes: [], leaveEvents: [], outliers: [] };
}
