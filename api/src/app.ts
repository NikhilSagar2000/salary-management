import express from 'express';
import type pg from 'pg';
import { authRoutes, requireSession } from './auth/routes.ts';
import { deleteSession, SESSION_COOKIE, sessionToken } from './auth/sessions.ts';
import type { ErrorRequestHandler } from 'express';
import { requestTimezone, todayIn, type Clock } from './clock.ts';
import { employeeRoutes } from './employees/routes.ts';
import { FieldProblem, sendFieldErrors } from './http.ts';
import { importRoutes } from './csv/routes.ts';
import { statsRoutes } from './stats/routes.ts';

export type Config = { passwordHash: string; production: boolean };

export function createApp(deps: { db: pg.Pool; clock: Clock; config: Config }) {
  const app = express();
  // Render puts one proxy in front; trust it so req.ip is the browser's address.
  if (deps.config.production) app.set('trust proxy', 1);
  app.use(express.json());
  // "Today" is the date in the browser's timezone (TIME-1).
  app.use((req, res, next) => {
    res.locals.today = todayIn(deps.clock, requestTimezone(req.get('X-Timezone')));
    next();
  });
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
  app.use(employeeRoutes(deps));
  app.use(statsRoutes(deps));
  app.use(importRoutes(deps));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  app.use(errorHandler);
  return app;
}

/** Errors answer in plain words; details go to the server log only, never to the browser. */
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof FieldProblem) return sendFieldErrors(res, err.fields);
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: "The request couldn't be read. Reload the page and try again." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again in a minute.' });
};
