import type pg from 'pg';
import type { Clock } from '../clock.ts';

export const NEW_CHAT_TITLE = 'New chat';

export async function createChat(db: pg.Pool, clock: Clock) {
  const { rows } = await db.query(
    'INSERT INTO chats (title, created_at, updated_at) VALUES ($1, $2, $2) RETURNING id, title, updated_at AS "updatedAt"',
    [NEW_CHAT_TITLE, clock.now()],
  );
  return rows[0];
}

export async function listChats(db: pg.Pool) {
  const { rows } = await db.query('SELECT id, title, updated_at AS "updatedAt" FROM chats ORDER BY updated_at DESC, id DESC');
  return rows;
}

export async function getChat(db: pg.Pool, id: number) {
  const { rows } = await db.query('SELECT id, title, updated_at AS "updatedAt" FROM chats WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const { rows: messages } = await db.query(
    `SELECT id, role, content, sources, based_on_data AS "basedOnData", status, error_kind AS "errorKind", created_at AS "createdAt"
     FROM chat_messages WHERE chat_id = $1 ORDER BY id`,
    [id],
  );
  return { ...rows[0], messages };
}

export async function renameChat(db: pg.Pool, id: number, title: string): Promise<boolean> {
  return (await db.query('UPDATE chats SET title = $2 WHERE id = $1', [id, title])).rowCount === 1;
}

export async function deleteChat(db: pg.Pool, id: number): Promise<boolean> {
  return (await db.query('DELETE FROM chats WHERE id = $1', [id])).rowCount === 1;
}
