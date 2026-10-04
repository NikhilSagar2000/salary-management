import { chatTitleSchema, MSG, questionSchema } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import type { Clock } from '../clock.ts';
import { fieldErrors } from '../http.ts';
import { chatHistory, createChat, deleteChat, getChat, listChats, renameChat, saveAnswer, saveQuestion } from './chats.ts';
import { freeRequestsLeft, ModelError, type ModelFn } from './model.ts';
import type { Config } from '../app.ts';
import { answerQuestion, type AnswerEvent } from './run.ts';

export function assistantRoutes({ db, clock, model, config }: { db: pg.Pool; clock: Clock; model: ModelFn; config: Config }) {
  const router = Router();
  // ponytail: in-memory, fine for one server; a row lock in Postgres if the API ever runs on several
  const answering = new Set<number>();
  const noChat = (res: import('express').Response) => res.status(404).json({ error: MSG.noChat });

  // AST-16: asked on the server with the server's key; only the number reaches the browser (AST-17).
  router.get('/api/assistant/status', async (_req, res) => {
    res.json({ freeRequestsLeft: await freeRequestsLeft(config.openRouter) });
  });

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
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    const { question } = parsed.data;
    if (!(await getChat(db, chatId))) return noChat(res);
    if (answering.has(chatId)) {
      res.status(409).json({ error: MSG.answerInProgress });
      return;
    }
    answering.add(chatId);
    try {
      await answer(chatId, question, res);
    } finally {
      answering.delete(chatId);
    }
  });

  async function answer(chatId: number, question: string, res: import('express').Response) {
    const history = await chatHistory(db, chatId);
    await saveQuestion(db, clock, chatId, question);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    // Closing the stream (the Stop button, or leaving the page) stops the model (AST-12).
    const stop = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) stop.abort();
    });
    let partial = '';
    const send = (e: AnswerEvent) => {
      if (e.type === 'token') partial += e.text;
      const { type, ...data } = e;
      if (!stop.signal.aborted) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const result = await answerQuestion({ model, db, today: res.locals.today, history, question, signal: stop.signal, onEvent: send });
      await saveAnswer(db, clock, chatId, { content: result.text, sources: result.sources, basedOnData: result.basedOnData, status: 'complete' });
    } catch (err) {
      if (stop.signal.aborted) {
        await saveAnswer(db, clock, chatId, { content: partial, sources: null, basedOnData: null, status: 'stopped' });
      } else {
        // AST-14/15: say what happened in plain words; the question stays saved and the rest of the app is unaffected.
        const kind = err instanceof ModelError ? err.kind : 'unavailable';
        if (!(err instanceof ModelError)) console.error(err);
        const message = kind === 'rate_limited' ? MSG.rateLimited : MSG.assistantUnavailable;
        res.write(`event: error\ndata: ${JSON.stringify({ kind, message })}\n\n`);
        await saveAnswer(db, clock, chatId, { content: message, sources: null, basedOnData: null, status: 'error', errorKind: kind });
      }
    }
    res.end();
  }

  return router;
}
