import express from 'express';
import type pg from 'pg';
import type { Clock } from './clock.ts';

export type Config = { passwordHash: string; production: boolean };

export function createApp(_deps: { db: pg.Pool; clock: Clock; config: Config }) {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}
