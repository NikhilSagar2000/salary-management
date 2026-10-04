import type pg from 'pg';

export async function migrate(_db: pg.Pool, _dir: string): Promise<string[]> {
  throw new Error('not implemented');
}
