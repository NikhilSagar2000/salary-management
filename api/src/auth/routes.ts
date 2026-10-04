import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import type { Config } from '../app.ts';
import type { Clock } from '../clock.ts';
import { verifyPassword } from './password.ts';
import { createSession, isValidSession, SESSION_COOKIE, SESSION_DAYS, sessionToken } from './sessions.ts';

const MAX_TRIES = 5;
const WINDOW_MS = 15 * 60_000;

export function authRoutes({ db, clock, config }: { db: pg.Pool; clock: Clock; config: Config }) {
  const router = Router();
  // ponytail: in-memory per IP, fine for one server; move to Postgres if the API ever runs on several
  const tries = new Map<string, { failures: number[]; lockedUntil: number }>();

  router.post('/api/session', async (req, res) => {
    const now = clock.now().getTime();
    const ip = req.ip ?? 'unknown';
    const entry = tries.get(ip) ?? { failures: [], lockedUntil: 0 };
    if (now < entry.lockedUntil) {
      res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!(await verifyPassword(password, config.passwordHash))) {
      entry.failures = [...entry.failures.filter((t) => now - t < WINDOW_MS), now];
      if (entry.failures.length >= MAX_TRIES) entry.lockedUntil = now + WINDOW_MS;
      tries.set(ip, entry);
      res.status(401).json({ error: "That password isn't right." });
      return;
    }
    tries.delete(ip);
    res.cookie(SESSION_COOKIE, await createSession(db, clock), {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.production,
      maxAge: SESSION_DAYS * 86_400_000,
      path: '/',
    });
    res.status(204).end();
  });

  return router;
}

/** Lets a request through only with a valid session. */
export function requireSession({ db, clock }: { db: pg.Pool; clock: Clock }): RequestHandler {
  return async (req, res, next) => {
    if (await isValidSession(db, clock, sessionToken(req.get('cookie')))) return next();
    res.status(401).json({ error: 'Please sign in.' });
  };
}
