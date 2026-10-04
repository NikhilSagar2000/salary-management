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
  const timeoutMs = cfg.timeoutMs ?? 60_000;
  // OpenRouter refuses a `models` list longer than three (400), so extra fallbacks are dropped.
  const models = cfg.models.slice(0, 3);
  return async function* ({ messages, tools, signal }) {
    // Gives up after `timeoutMs` without any data (AST-15); a stop from the caller stays an AbortError.
    const quiet = new AbortController();
    let timer = setTimeout(() => quiet.abort(), timeoutMs);
    const stillHearing = () => {
      clearTimeout(timer);
      timer = setTimeout(() => quiet.abort(), timeoutMs);
    };
    const unavailable = (err: unknown): never => {
      if (signal.aborted) throw err;
      throw err instanceof ModelError ? err : new ModelError('unavailable', String((err as Error)?.message ?? err));
    };
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}`, 'x-title': 'ACME Salary Management' },
        body: JSON.stringify({ model: models[0], models, messages, stream: true, ...(tools.length ? { tools } : {}) }),
        signal: AbortSignal.any([signal, quiet.signal]),
      }).catch(unavailable);
      if (res.status === 429) throw new ModelError('rate_limited', 'OpenRouter rate limit');
      if (!res.ok || !res.body) {
        // OpenRouter's own reason goes into the server log (routes.ts); the browser only sees the plain message.
        const reason = (await res.json().catch(() => null))?.error?.message;
        throw new ModelError('unavailable', `OpenRouter answered ${res.status}${reason ? `: ${reason}` : ''}`);
      }
      stillHearing();
      yield* readStream(res.body, stillHearing);
    } catch (err) {
      unavailable(err);
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Turns OpenRouter's server-sent events into ModelEvents. */
async function* readStream(body: ReadableStream<Uint8Array>, onData: () => void): AsyncIterable<ModelEvent> {
  const calls = new Map<number, { id: string; name: string; args: string }>();
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    onData();
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue; // blank lines and ": OPENROUTER PROCESSING" keep-alives
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      const event = JSON.parse(data);
      if (event.error) throw new ModelError(event.error.code === 429 ? 'rate_limited' : 'unavailable', String(event.error.message));
      const delta = event.choices?.[0]?.delta ?? {};
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
}

/** Free-model requests left today (OpenRouter's GET /key), or null when unknown. Printed by `npm run smoke:model`. */
export async function freeRequestsLeft(cfg: { baseUrl: string; apiKey: string }): Promise<number | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/key`, { headers: { authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(5000) });
    const remaining = (await res.json())?.data?.free_model_daily_requests?.remaining;
    return typeof remaining === 'number' ? remaining : null;
  } catch {
    return null;
  }
}
