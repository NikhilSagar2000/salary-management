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

/**
 * Streams a chat completion from OpenRouter (OpenAI-compatible), with OpenRouter's `models` fallback list.
 * Tool-call fragments are joined per index and emitted when the stream ends.
 */
export function openRouterModel(cfg: { baseUrl: string; apiKey: string; models: string[]; timeoutMs?: number }): ModelFn {
  return async function* ({ messages, tools, signal }) {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}`, 'x-title': 'ACME Salary Management' },
      body: JSON.stringify({ model: cfg.models[0], models: cfg.models, messages, stream: true, ...(tools.length ? { tools } : {}) }),
      signal,
    });
    const calls = new Map<number, { id: string; name: string; args: string }>();
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue; // blank lines and ": OPENROUTER PROCESSING" keep-alives
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        const delta = JSON.parse(data).choices?.[0]?.delta ?? {};
        if (delta.content) yield { type: 'token', text: delta.content };
        for (const tc of delta.tool_calls ?? []) {
          const call = calls.get(tc.index) ?? { id: '', name: '', args: '' };
          call.id ||= tc.id ?? '';
          call.name ||= tc.function?.name ?? '';
          call.args += tc.function?.arguments ?? '';
          calls.set(tc.index, call);
        }
      }
    }
    for (const [, call] of [...calls].sort(([a], [b]) => a - b)) {
      let args: unknown = call.args;
      try {
        args = call.args ? JSON.parse(call.args) : {};
      } catch {
        // Unparseable arguments go to the tool as text; it answers with an error the model can correct.
      }
      yield { type: 'tool_call', id: call.id, name: call.name, args };
    }
    yield { type: 'done' };
  };
}
