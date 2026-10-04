import type { Db } from '../db.ts';
import type { ModelFn } from './model.ts';
import type { Source } from './tools.ts';

export type Sources = { groups: Extract<Source, { kind: 'group' }>[]; people: Extract<Source, { kind: 'person' }>[]; morePeople: number };
export type AnswerEvent =
  | { type: 'step'; text: string }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: Sources; basedOnData: boolean }
  | { type: 'done' };
export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

export async function answerQuestion(_opts: {
  model: ModelFn; db: Db & { connect: () => Promise<unknown> }; today: string; history: HistoryMessage[]; question: string;
  signal: AbortSignal; onEvent: (e: AnswerEvent) => void;
}): Promise<{ text: string; sources: Sources; basedOnData: boolean }> {
  return { text: '', sources: { groups: [], people: [], morePeople: 0 }, basedOnData: false };
}
