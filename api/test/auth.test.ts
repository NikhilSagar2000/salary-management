import request from 'supertest';
import { expect, test } from 'vitest';
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

test.fails('locks sign-in for 15 minutes after 5 wrong tries from one IP', async () => {
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
