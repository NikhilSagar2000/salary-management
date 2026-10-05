import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { expect, test } from 'vitest';
import { signIn, testApp } from './helpers.ts';

test('serves the built web app: its files, index.html for app routes, JSON under /api', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'acme-web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ACME Pay</title>');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
  const { app } = await testApp({ webDir: dir });

  const page = await request(app).get('/employees/E000123?country=BR');
  expect(page.status).toBe(200);
  expect(page.type).toBe('text/html');
  expect(page.text).toContain('<title>ACME Pay</title>');
  expect((await request(app).get('/assets/app.js')).text).toBe('console.log(1)');
  expect((await request(app).get('/assets/gone.js')).status).toBe(404); // a missing file is not answered with the page

  const agent = await signIn(app);
  const missing = await agent.get('/api/nothing-here');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ error: 'Not found.' });
});

test('every response carries the security headers; HSTS only in production (AUTH-7)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'acme-web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ACME Pay</title>');
  for (const production of [false, true]) {
    const { app } = await testApp({ production, webDir: dir });
    for (const path of ['/employees', '/api/health', '/api/employees']) {
      const h = (await request(app).get(path)).headers;
      const csp = h['content-security-policy'] ?? '';
      expect(csp, path).toContain("script-src 'self'");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).toContain("object-src 'none'");
      expect(h['x-content-type-options'], path).toBe('nosniff');
      expect(h['referrer-policy'], path).toBe('same-origin');
      expect(h['x-powered-by'], path).toBeUndefined();
      expect(h['strict-transport-security'], path).toBe(production ? 'max-age=31536000' : undefined);
    }
  }
});
