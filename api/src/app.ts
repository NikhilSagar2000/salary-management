import express from 'express';
import type pg from 'pg';
import type { Clock } from './clock.ts';

export function createApp(_deps: { db: pg.Pool; clock: Clock }) {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}
