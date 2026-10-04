import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import type { Config } from '../app.ts';
import type { Clock } from '../clock.ts';
import { verifyPassword } from './password.ts';
import { createSession, isValidSession, SESSION_COOKIE, SESSION_DAYS, sessionToken } from './sessions.ts';

export function authRoutes({ db, clock, config }: { db: pg.Pool; clock: Clock; config: Config }) {
  const router = Router();

  router.post('/api/session', async (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!(await verifyPassword(password, config.passwordHash))) {
      res.status(401).json({ error: "That password isn't right." });
      return;
    }
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
