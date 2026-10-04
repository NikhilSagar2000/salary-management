import express from 'express';
import type pg from 'pg';
import { authRoutes, requireSession } from './auth/routes.ts';
import type { Clock } from './clock.ts';

export type Config = { passwordHash: string; production: boolean };

export function createApp(deps: { db: pg.Pool; clock: Clock; config: Config }) {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(authRoutes(deps));
  // Everything else under /api needs a session.
  app.use('/api', requireSession(deps));
  app.get('/api/session', (_req, res) => {
    res.json({ signedIn: true });
  });
  return app;
}
