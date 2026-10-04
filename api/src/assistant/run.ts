// One question → one streamed answer, using the tools (AST-3, AST-6, AST-8, AST-9, AST-13).
import type pg from 'pg';
import type { ChatMessage, ModelEvent, ModelFn, ToolCall } from './model.ts';
import { systemPrompt } from './prompt.ts';
import { describeFilters, runTool, TOOLS, type Source } from './tools.ts';

export type Sources = { groups: Extract<Source, { kind: 'group' }>[]; people: Extract<Source, { kind: 'person' }>[]; morePeople: number };
export type AnswerEvent =
  | { type: 'step'; text: string }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: Sources; basedOnData: boolean }
  | { type: 'done' };
export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

const MAX_TOOL_ROUNDS = 6;
/** AST-13: earlier messages sent with each question, to bound context and free-tier cost. */
const HISTORY_LIMIT = 20;
const OUT_OF_LOOKUPS = 'You have used all your lookups. Answer now from what you found, and say plainly what you could not check.';

/** "Working out salary for United States…": what the assistant is doing, in words. */
function stepText(name: string, args: Record<string, unknown>): string {
  const who = describeFilters((args.filters ?? {}) as Parameters<typeof describeFilters>[0]);
  if (name === 'aggregate') return `Working out ${String(args.metric ?? 'numbers').replace('_pct', ' %')} for ${who === 'Everyone' ? 'everyone' : who}…`;
  if (name === 'get_employee') return `Reading ${String(args.code)}'s record…`;
  if (name === 'query_changes') return `Looking at changes for ${who === 'Everyone' ? 'everyone' : who}…`;
  return `Looking up people: ${who}…`;
}

export async function answerQuestion(opts: {
  model: ModelFn; db: pg.Pool; today: string; history: HistoryMessage[]; question: string;
  signal: AbortSignal; onEvent: (e: AnswerEvent) => void;
}): Promise<{ text: string; sources: Sources; basedOnData: boolean }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(opts.today) },
    ...opts.history.slice(-HISTORY_LIMIT),
    { role: 'user', content: opts.question },
  ];
  const found: Source[] = [];
  let usedTools = false;
  let text = '';
  for (let round = 0; ; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS;
    if (lastRound) messages.push({ role: 'user', content: OUT_OF_LOOKUPS });
    const calls: Extract<ModelEvent, { type: 'tool_call' }>[] = [];
    for await (const event of opts.model({ messages, tools: lastRound ? [] : TOOLS, signal: opts.signal })) {
      if (event.type === 'token') {
        text += event.text;
        opts.onEvent({ type: 'token', text: event.text });
      }
      if (event.type === 'tool_call' && !lastRound) calls.push(event);
    }
    if (!calls.length) break;
    messages.push({
      role: 'assistant', content: null,
      tool_calls: calls.map((c): ToolCall => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })),
    });
    for (const call of calls) {
      opts.onEvent({ type: 'step', text: stepText(call.name, (call.args ?? {}) as Record<string, unknown>) });
      const { result, sources } = await runTool(opts.db, opts.today, call.name, call.args);
      usedTools = true;
      found.push(...sources);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  const sources = collectSources(found);
  opts.onEvent({ type: 'sources', sources, basedOnData: usedTools });
  opts.onEvent({ type: 'done' });
  return { text, sources, basedOnData: usedTools };
}

const SHOWN_PEOPLE = 20;

/** AST-8: each group once; people once each, the first 20 shown and the rest counted (the group links open the full list). */
function collectSources(found: Source[]): Sources {
  const groups = new Map<string, Extract<Source, { kind: 'group' }>>();
  const people = new Map<string, Extract<Source, { kind: 'person' }>>();
  for (const s of found) {
    if (s.kind === 'group') groups.set(`${s.label}|${s.query}`, s);
    else people.set(s.code, s);
  }
  const all = [...people.values()];
  return { groups: [...groups.values()], people: all.slice(0, SHOWN_PEOPLE), morePeople: Math.max(0, all.length - SHOWN_PEOPLE) };
}
