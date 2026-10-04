import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { expect, test } from 'vitest';
import { migrate } from '../src/migrate.ts';
import { testApp, testDbUrl, testPool } from './helpers.ts';

test('health answers ok', async () => {
  const { app } = await testApp();
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

test('migrations apply once and are recorded', async () => {
  const admin = testPool();
  await admin.query('DROP SCHEMA IF EXISTS migrate_test CASCADE; CREATE SCHEMA migrate_test');
  const db = new pg.Pool({ connectionString: testDbUrl(), options: '-c search_path=migrate_test' });
  const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
  await writeFile(join(dir, '001_first.sql'), 'CREATE TABLE things (id int)');
  await writeFile(join(dir, '002_second.sql'), 'INSERT INTO things VALUES (1)');
  try {
    expect(await migrate(db, dir)).toEqual(['001_first.sql', '002_second.sql']);
    expect(await migrate(db, dir)).toEqual([]);
    const recorded = await db.query('SELECT name FROM schema_migrations ORDER BY name');
    expect(recorded.rows.map((r) => r.name)).toEqual(['001_first.sql', '002_second.sql']);
    expect((await db.query('SELECT count(*)::int AS n FROM things')).rows[0].n).toBe(1);
  } finally {
    await db.end();
  }
});
