import request from 'supertest';
import { expect, test } from 'vitest';
import { testApp } from './helpers.ts';

test.fails('health answers ok', async () => {
  const { app } = await testApp();
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
