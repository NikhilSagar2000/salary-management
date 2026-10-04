import request from 'supertest';
import { expect, test } from 'vitest';
import { testApp } from './helpers.ts';

test('rejects /api requests without a session', async () => {
  const { app } = await testApp();
  for (const path of ['/api/session', '/api/employees']) {
    const res = await request(app).get(path);
    expect(res.status, path).toBe(401);
    expect(res.body).toEqual({ error: 'Please sign in.' });
  }
  expect((await request(app).get('/api/health')).status).toBe(200);
});
