import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import pg from 'pg';
import { expect, test } from 'vitest';
import { MIGRATIONS_DIR } from '../src/migrate.ts';
import { testDbUrl, testPool } from './helpers.ts';

const API_DIR = new URL('..', import.meta.url).pathname;

/** Starts `src/main.ts` and resolves with its output once it logs `until`, or when it exits. */
function start(env: Record<string, string>, until: RegExp) {
  const child = spawn(process.execPath, ['src/main.ts'], { cwd: API_DIR, env: { ...process.env, PORT: '0', NODE_ENV: 'test', ...env } });
  let output = '';
  return new Promise<{ output: string; code: number | null; stop: () => void }>((resolve) => {
    const done = (code: number | null) => resolve({ output, code, stop: () => child.kill() });
    const read = (chunk: Buffer) => {
      output += chunk;
      if (until.test(output)) done(null);
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('exit', done);
  });
}

test('the server applies migrations to an empty database before it listens', async () => {
  const admin = testPool();
  await admin.query('DROP DATABASE IF EXISTS acme_start_test WITH (FORCE)');
  await admin.query('CREATE DATABASE acme_start_test');
  const url = new URL(testDbUrl());
  url.pathname = '/acme_start_test';
  const server = await start({ DATABASE_URL: url.href, APP_PASSWORD_HASH: 'scrypt:test:test' }, /listening/);
  server.stop();
  expect(server.output).toMatch(/listening/);
  const db = new pg.Pool({ connectionString: url.href });
  try {
    const { rows } = await db.query('SELECT name FROM schema_migrations ORDER BY name');
    expect(rows.map((r) => r.name)).toEqual((await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort());
  } finally {
    await db.end();
    await admin.query('DROP DATABASE IF EXISTS acme_start_test WITH (FORCE)');
  }
}, 30_000);

test('the server refuses to start without a password hash, saying why', async () => {
  const server = await start({ DATABASE_URL: testDbUrl(), APP_PASSWORD_HASH: '' }, /listening/);
  server.stop();
  expect(server.code).toBe(1);
  expect(server.output).toContain('APP_PASSWORD_HASH is not set');
}, 30_000);
