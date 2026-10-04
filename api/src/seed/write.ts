import type pg from 'pg';
import type { Seed } from './generate.ts';
export async function writeSeed(_db: pg.Pool, _seed: Seed): Promise<void> {}
