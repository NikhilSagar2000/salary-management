import express from 'express';
import type pg from 'pg';
import { authRoutes, requireSession } from './auth/routes.ts';
import { deleteSession, SESSION_COOKIE, sessionToken } from './auth/sessions.ts';
import type { Clock } from './clock.ts';

export type Config = { passwordHash: string; production: boolean };

export function createApp(deps: { db: pg.Pool; clock: Clock; config: Config }) {
  const app = express();
  // Render puts one proxy in front; trust it so req.ip is the browser's address.
  if (deps.config.production) app.set('trust proxy', 1);
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
  app.delete('/api/session', async (req, res) => {
    await deleteSession(deps.db, sessionToken(req.get('cookie')));
    res.clearCookie(SESSION_COOKIE, { path: '/' }).status(204).end();
  });
  return app;
}
