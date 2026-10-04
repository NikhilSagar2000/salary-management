import type pg from 'pg';

export type Source = { kind: 'group'; label: string; query: string; headcount: number } | { kind: 'person'; code: string; name: string };

export async function runTool(_db: pg.Pool, _today: string, _name: string, _args: unknown): Promise<{ result: unknown; sources: Source[] }> {
  return { result: null, sources: [] };
}
