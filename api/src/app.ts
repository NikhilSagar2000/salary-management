import express from 'express';
import type pg from 'pg';
import type { Clock } from './clock.ts';

export type Config = { passwordHash: string; production: boolean };

export function createApp(_deps: { db: pg.Pool; clock: Clock; config: Config }) {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  // Everything else under /api needs a session.
  app.use('/api', (_req, res) => {
    res.status(401).json({ error: 'Please sign in.' });
  });
  return app;
}
