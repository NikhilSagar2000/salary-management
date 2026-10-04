import type pg from 'pg';
import type { Clock } from '../clock.ts';

export const NEW_CHAT_TITLE = 'New chat';
const TITLE_FROM_QUESTION = 60;

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

/** Earlier messages to give the model: questions and answers that finished or were stopped. */
export async function chatHistory(db: pg.Pool, chatId: number) {
  const { rows } = await db.query(
    "SELECT role, content FROM chat_messages WHERE chat_id = $1 AND status <> 'error' ORDER BY id",
    [chatId],
  );
  return rows as { role: 'user' | 'assistant'; content: string }[];
}

/** Saves the question; the first one also names the chat (AST-1). */
export async function saveQuestion(db: pg.Pool, clock: Clock, chatId: number, question: string) {
  await db.query("INSERT INTO chat_messages (chat_id, role, content, created_at) VALUES ($1, 'user', $2, $3)", [chatId, question, clock.now()]);
  await db.query(
    `UPDATE chats SET updated_at = $3,
       title = CASE WHEN (SELECT count(*) FROM chat_messages WHERE chat_id = $1) = 1 THEN $2 ELSE title END
     WHERE id = $1`,
    [chatId, question.slice(0, TITLE_FROM_QUESTION).trim(), clock.now()],
  );
}

export async function saveAnswer(
  db: pg.Pool, clock: Clock, chatId: number,
  a: { content: string; sources: unknown; basedOnData: boolean | null; status: 'complete' | 'stopped' | 'error'; errorKind?: string },
) {
  await db.query(
    `INSERT INTO chat_messages (chat_id, role, content, sources, based_on_data, status, error_kind, created_at)
     VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7)`,
    [chatId, a.content, a.sources === null ? null : JSON.stringify(a.sources), a.basedOnData, a.status, a.errorKind ?? null, clock.now()],
  );
  await db.query('UPDATE chats SET updated_at = $2 WHERE id = $1', [chatId, clock.now()]);
}
