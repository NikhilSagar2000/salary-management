import type { ToolSpec } from './tools.ts';

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type ModelEvent = { type: 'token'; text: string } | { type: 'tool_call'; id: string; name: string; args: unknown } | { type: 'done' };
export type ModelRequest = { messages: ChatMessage[]; tools: ToolSpec[]; signal: AbortSignal };
/** A streaming chat model. Throws ModelError when it can't answer. */
export type ModelFn = (req: ModelRequest) => AsyncIterable<ModelEvent>;

export class ModelError extends Error {
  kind: 'rate_limited' | 'unavailable';
  constructor(kind: 'rate_limited' | 'unavailable', message: string) {
    super(message);
    this.kind = kind;
  }
}
