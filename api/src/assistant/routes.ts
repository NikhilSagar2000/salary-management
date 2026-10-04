import { chatTitleSchema, MSG } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import type { Clock } from '../clock.ts';
import { fieldErrors } from '../http.ts';
import { chatHistory, createChat, deleteChat, getChat, listChats, renameChat, saveAnswer, saveQuestion } from './chats.ts';
import type { ModelFn } from './model.ts';
import { answerQuestion, type AnswerEvent } from './run.ts';

export function assistantRoutes({ db, clock, model }: { db: pg.Pool; clock: Clock; model: ModelFn }) {
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

  router.post('/api/chats/:id/messages', async (req, res) => {
    const chatId = Number(req.params.id);
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!(await getChat(db, chatId))) return noChat(res);
    const history = await chatHistory(db, chatId);
    await saveQuestion(db, clock, chatId, question);

    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const send = (e: AnswerEvent) => {
      const { type, ...data } = e;
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const answer = await answerQuestion({
      model, db, today: res.locals.today, history, question, signal: new AbortController().signal, onEvent: send,
    });
    await saveAnswer(db, clock, chatId, { content: answer.text, sources: answer.sources, basedOnData: answer.basedOnData, status: 'complete' });
    res.end();
  });

  return router;
}
