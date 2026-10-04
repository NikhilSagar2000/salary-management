import { expect, test } from 'vitest';
import { asText, insertPeople, scriptedModel, sseEvents, signIn, testApp } from './helpers.ts';

test('creates, lists newest first, renames (1–80 characters) and deletes chats', async () => {
  const { app, clock } = await testApp();
  const agent = await signIn(app);
  const first = await agent.post('/api/chats').send({});
  expect(first.status).toBe(201);
  expect(first.body).toMatchObject({ id: expect.any(Number), title: 'New chat' });
  clock.set('2026-10-01T13:00:00Z');
  const second = (await agent.post('/api/chats').send({})).body;
  expect((await agent.get('/api/chats')).body.map((c: { id: number }) => c.id)).toEqual([second.id, first.body.id]);

  expect((await agent.patch(`/api/chats/${first.body.id}`).send({ title: '  Pay in Germany  ' })).status).toBe(200);
  for (const title of ['', '   ', 'x'.repeat(81)]) {
    const bad = await agent.patch(`/api/chats/${first.body.id}`).send({ title });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toEqual({ title: 'A chat name needs 1 to 80 characters.' });
  }
  expect((await agent.get(`/api/chats/${first.body.id}`)).body).toMatchObject({ title: 'Pay in Germany', messages: [] });

  expect((await agent.delete(`/api/chats/${first.body.id}`)).status).toBe(204);
  expect((await agent.get(`/api/chats/${first.body.id}`)).status).toBe(404);
  expect((await agent.get('/api/chats')).body.map((c: { id: number }) => c.id)).toEqual([second.id]);
});

async function chatWith(rounds: Parameters<typeof scriptedModel>[0]) {
  const { model, requests } = scriptedModel(rounds);
  const { app, db } = await testApp({ model });
  await insertPeople(db, [{ code: 'E000001', firstName: 'Ana', lastName: 'Silva', country: 'US', salary: 100000 }]);
  const agent = await signIn(app);
  const chat = (await agent.post('/api/chats').send({})).body as { id: number };
  const ask = (question: string) => agent.post(`/api/chats/${chat.id}/messages`).send({ question }).buffer(true).parse(asText);
  return { agent, chat, ask, requests, db };
}

test('titles a new chat with its first question cut to 60 characters', async () => {
  const { agent, chat, ask } = await chatWith([
    [{ type: 'token', text: 'One.' }, { type: 'done' }],
    [{ type: 'token', text: 'Two.' }, { type: 'done' }],
  ]);
  const first = 'What is the median salary for software engineers at level four in the United States?';
  expect((await ask(first)).status).toBe(200);
  expect((await agent.get(`/api/chats/${chat.id}`)).body.title).toBe(first.slice(0, 60).trim());
  await ask('And in Germany?');
  expect((await agent.get(`/api/chats/${chat.id}`)).body.title).toBe(first.slice(0, 60).trim());
});
