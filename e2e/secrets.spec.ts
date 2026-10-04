import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { E2E_MODEL_KEY, E2E_PASSWORD, WEB_DIST } from './env.ts';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

/** Values from a local .env that must stay on the server (keys, hashes, connection strings). */
function serverSecrets(): string[] {
  const env = new URL('../.env', import.meta.url).pathname;
  if (!existsSync(env)) return [];
  return readFileSync(env, 'utf8').split('\n')
    .map((line) => /^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => !!m && /KEY|HASH|SECRET|PASSWORD|URL/.test(m[1]!) && m[2]!.length >= 8)
    .map((m) => m[2]!.replace(/^["']|["']$/g, ''));
}

test('the built web bundle holds no secret', async ({ request }) => {
  const bundle = files(WEB_DIST).map((f) => readFileSync(f, 'utf8')).join('\n');
  const html = await (await request.get('/')).text();
  const served = await Promise.all([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(async ([, path]) => (await request.get(path!)).text()));
  expect(served.length).toBeGreaterThan(0);
  for (const text of [bundle, html, ...served]) {
    for (const secret of [E2E_MODEL_KEY, E2E_PASSWORD, 'OPENROUTER_API_KEY', 'APP_PASSWORD_HASH', 'DATABASE_URL', ...serverSecrets()]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/sk-or-v1-[0-9a-f]{16,}/); // an OpenRouter key
    expect(text).not.toMatch(/scrypt:[\w-]{16,}:/); // a password hash
  }
});
