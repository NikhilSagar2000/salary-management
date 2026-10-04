import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import { createPool, DEV_DATABASE_URL, withTx } from './db.ts';

export const MIGRATIONS_DIR = new URL('../db/migrations', import.meta.url).pathname;

/** Runs each not-yet-applied .sql file in `dir`, in name order, each in its own transaction. */
export async function migrate(db: pg.Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql') && !done.has(f)).sort();
  for (const file of files) {
    const sql = await readFile(join(dir, file), 'utf8');
    await withTx(db, async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }).catch((err) => {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    });
  }
  return files;
}

if (import.meta.main) {
  const db = createPool(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
  const applied = await migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply');
  await db.end();
}
