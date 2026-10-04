import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { verifyPassword } from '../src/auth/password.ts';
import { PASSWORD, testApp } from './helpers.ts';

test('rejects /api requests without a session', async () => {
  const { app } = await testApp();
  for (const path of ['/api/session', '/api/employees']) {
    const res = await request(app).get(path);
    expect(res.status, path).toBe(401);
    expect(res.body).toEqual({ error: 'Please sign in.' });
  }
  expect((await request(app).get('/api/health')).status).toBe(200);
});

test('signs in with the right password and sets a 7-day httpOnly cookie', async () => {
  const { app, clock } = await testApp();
  const res = await request(app).post('/api/session').send({ password: PASSWORD });
  expect(res.status).toBe(204);
  const cookie = res.headers['set-cookie']![0]!;
  expect(cookie).toMatch(/^acme_session=[A-Za-z0-9_-]{43};/);
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).toContain('Max-Age=604800');
  expect(cookie).toContain('Path=/');
  expect(cookie).not.toContain('Secure');
  const session = cookie.split(';')[0]!;
  expect((await request(app).get('/api/session').set('Cookie', session)).status).toBe(200);
  clock.set('2026-10-08T12:00:01Z'); // 7 days and a second later
  expect((await request(app).get('/api/session').set('Cookie', session)).status).toBe(401);
});

test('the session cookie is Secure in production', async () => {
  const { app } = await testApp({ production: true });
  const res = await request(app).post('/api/session').send({ password: PASSWORD });
  expect(res.headers['set-cookie']![0]).toContain('Secure');
});

test('rejects a wrong password with a plain message', async () => {
  const { app } = await testApp();
  for (const body of [{ password: 'wrong' }, {}, { password: 42 }]) {
    const res = await request(app).post('/api/session').send(body);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "That password isn't right." });
    expect(res.headers['set-cookie']).toBeUndefined();
  }
});

test('locks sign-in for 15 minutes after 5 wrong tries from one IP', async () => {
  const { app, clock } = await testApp();
  for (let i = 0; i < 5; i++) {
    expect((await request(app).post('/api/session').send({ password: 'wrong' })).status).toBe(401);
  }
  const locked = await request(app).post('/api/session').send({ password: PASSWORD });
  expect(locked.status).toBe(429);
  expect(locked.body).toEqual({ error: 'Too many tries. Wait 15 minutes and try again.' });
  clock.set('2026-10-01T12:14:59Z');
  expect((await request(app).post('/api/session').send({ password: PASSWORD })).status).toBe(429);
  clock.set('2026-10-01T12:15:01Z');
  expect((await request(app).post('/api/session').send({ password: PASSWORD })).status).toBe(204);
});

test('sign-out makes the old cookie stop working', async () => {
  const { app } = await testApp();
  const signedIn = await request(app).post('/api/session').send({ password: PASSWORD });
  const session = signedIn.headers['set-cookie']![0]!.split(';')[0]!;
  const out = await request(app).delete('/api/session').set('Cookie', session);
  expect(out.status).toBe(204);
  expect(out.headers['set-cookie']![0]).toMatch(/^acme_session=;/);
  expect((await request(app).get('/api/session').set('Cookie', session)).status).toBe(401);
});

test('no response or log line contains the password hash or stored session hashes', async () => {
  const { app, db, config } = await testApp();
  const logged: string[] = [];
  const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args) => void logged.push(args.map(String).join(' '))),
  );
  const seen: string[] = [];
  const keep = (res: request.Response) => seen.push(JSON.stringify(res.headers), res.text ?? '');
  try {
    const ok = await request(app).post('/api/session').send({ password: PASSWORD });
    keep(ok);
    const cookie = ok.headers['set-cookie']![0]!.split(';')[0]!;
    keep(await request(app).get('/api/session').set('Cookie', cookie));
    keep(await request(app).get('/api/nope').set('Cookie', cookie));
    keep(await request(app).post('/api/session').set('Content-Type', 'application/json').send('{"password":'));
    for (let i = 0; i < 6; i++) keep(await request(app).post('/api/session').send({ password: 'wrong' }));
    keep(await request(app).delete('/api/session').set('Cookie', cookie));
  } finally {
    spies.forEach((s) => s.mockRestore());
  }
  const { rows } = await db.query('SELECT token_hash FROM sessions');
  const secrets = [config.passwordHash, config.passwordHash.split(':')[2]!, ...rows.map((r) => r.token_hash)];
  const everything = [...seen, ...logged].join('\n');
  for (const secret of secrets) expect(everything).not.toContain(secret);
});

test('malformed requests get a plain message, never internals', async () => {
  const { app } = await testApp();
  const res = await request(app).post('/api/session').set('Content-Type', 'application/json').send('{"password":');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: "The request couldn't be read. Reload the page and try again." });
  expect(res.text).not.toMatch(/at .*\.(ts|js):\d+/);
});

test.fails('hash-password script prints a hash that signs in with that password', () => {
  const out = execFileSync(process.execPath, ['src/hash-password.ts'], { input: 'a new password\n', encoding: 'utf8' });
  const hash = out.trim().split('\n').at(-1)!;
  return Promise.all([verifyPassword('a new password', hash), verifyPassword('another', hash)]).then(([right, wrong]) => {
    expect(right).toBe(true);
    expect(wrong).toBe(false);
  });
});
