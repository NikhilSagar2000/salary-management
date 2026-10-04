import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { Clock } from '../clock.ts';

export const SESSION_COOKIE = 'acme_session';
export const SESSION_DAYS = 7;

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: pg.Pool, clock: Clock): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(clock.now().getTime() + SESSION_DAYS * 86_400_000);
  await db.query('INSERT INTO sessions (token_hash, expires_at) VALUES ($1, $2)', [sha256(token), expires]);
  return token;
}

export async function isValidSession(db: pg.Pool, clock: Clock, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const { rowCount } = await db.query('SELECT 1 FROM sessions WHERE token_hash = $1 AND expires_at > $2', [sha256(token), clock.now()]);
  return rowCount === 1;
}

export async function deleteSession(db: pg.Pool, token: string | undefined): Promise<void> {
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

/** The session token from a Cookie header. */
export function sessionToken(cookieHeader: string | undefined): string | undefined {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return value.join('=');
  }
  return undefined;
}
