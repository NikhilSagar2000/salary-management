import { expect, test } from 'vitest';
import { answerQuestion, type AnswerEvent } from '../src/assistant/run.ts';
import { insertPeople, scriptedModel, testApp } from './helpers.ts';

const TODAY = '2026-10-01';

async function ask(rounds: Parameters<typeof scriptedModel>[0], opts: { history?: { role: 'user' | 'assistant'; content: string }[] } = {}) {
  const { db } = await testApp();
  await insertPeople(db, [
    { code: 'E000001', firstName: 'Ana', lastName: 'Silva', country: 'US', salary: 100000 },
    { code: 'E000002', firstName: 'Bo', lastName: 'Lee', country: 'US', salary: 120000 },
  ]);
  const { model, requests } = scriptedModel(rounds);
  const events: AnswerEvent[] = [];
  const answer = await answerQuestion({
    model, db, today: TODAY, history: opts.history ?? [], question: 'What is the median pay in the US?',
    signal: new AbortController().signal, onEvent: (e) => events.push(e),
  });
  return { answer, events, requests };
}

test('streams a step per tool call, then tokens, then sources, then done', async () => {
  const { events, answer } = await ask([
    [{ type: 'tool_call', id: 'c1', name: 'aggregate', args: { metric: 'salary', filters: { country: ['US'] } } }, { type: 'done' }],
    [{ type: 'token', text: 'The median is ' }, { type: 'token', text: 'USD 110,000.' }, { type: 'done' }],
  ]);
  expect(events.map((e) => e.type)).toEqual(['step', 'token', 'token', 'sources', 'done']);
  expect(events[0]).toEqual({ type: 'step', text: 'Working out salary for United States…' });
  expect(answer.text).toBe('The median is USD 110,000.');
  expect(answer.basedOnData).toBe(true);
});

test.fails('stops tool calls after 6 rounds and asks for an answer', async () => {
  const lookup = (n: number) => [{ type: 'tool_call' as const, id: `c${n}`, name: 'get_employee', args: { code: 'E000001' } }, { type: 'done' as const }];
  const { events, requests, answer } = await ask([
    ...Array.from({ length: 6 }, (_, i) => lookup(i)),
    [{ type: 'token', text: 'Here is what I found.' }, { type: 'done' }],
  ]);
  expect(events.filter((e) => e.type === 'step')).toHaveLength(6);
  expect(requests).toHaveLength(7);
  expect(requests.slice(0, 6).every((r) => r.tools.length === 4)).toBe(true);
  expect(requests[6]!.tools).toEqual([]);
  expect(requests[6]!.messages.at(-1)).toEqual({
    role: 'user', content: 'You have used all your lookups. Answer now from what you found, and say plainly what you could not check.',
  });
  expect(answer.text).toBe('Here is what I found.');
});
