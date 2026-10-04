import { chatTitleSchema, MSG } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import type { Clock } from '../clock.ts';
import { fieldErrors } from '../http.ts';
import { createChat, deleteChat, getChat, listChats, renameChat } from './chats.ts';

export function assistantRoutes({ db, clock }: { db: pg.Pool; clock: Clock }) {
  const router = Router();
  const noChat = (res: import('express').Response) => res.status(404).json({ error: MSG.noChat });

  router.get('/api/chats', async (_req, res) => {
    res.json(await listChats(db));
  });
  router.post('/api/chats', async (_req, res) => {
    res.status(201).json(await createChat(db, clock));
  });
  router.get('/api/chats/:id', async (req, res) => {
    const chat = await getChat(db, Number(req.params.id));
    if (!chat) return noChat(res);
    res.json(chat);
  });
  router.patch('/api/chats/:id', async (req, res) => {
    const parsed = chatTitleSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    if (!(await renameChat(db, Number(req.params.id), parsed.data.title))) return noChat(res);
    res.json({ id: Number(req.params.id), title: parsed.data.title });
  });
  router.delete('/api/chats/:id', async (req, res) => {
    if (!(await deleteChat(db, Number(req.params.id)))) return noChat(res);
    res.status(204).end();
  });

  return router;
}
