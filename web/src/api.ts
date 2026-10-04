import { MSG } from '@acme/shared';

/** A failed API call, with the server's plain message, any per-field messages, and the whole reply. */
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  data: unknown;
  constructor(status: number, message: string, fields: Record<string, string> = {}, data: unknown = null) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

type Init = { method?: string; body?: unknown; csv?: string; signal?: AbortSignal };

/** Sends a request with JSON or CSV text; any failure becomes an ApiError with a message in plain words. */
async function request(path: string, init: Init): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: {
        // TIME-1: the server works out "today" in the browser's timezone.
        'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init.csv === undefined ? {} : { 'content-type': 'text/csv; charset=utf-8' }),
      },
      body: init.csv ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new ApiError(0, MSG.offline);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error ?? MSG.serverError, data?.fields, data);
  }
  return res;
}

/** Calls the API with JSON (or CSV text) in and JSON out. */
export async function api<T = unknown>(path: string, init: Omit<Init, 'signal'> = {}): Promise<T> {
  const res = await request(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => null)) as T;
}

/** POSTs JSON and hands each server-sent event to `onEvent` as it arrives, until the stream ends or `signal` aborts. */
export async function apiStream(path: string, body: unknown, signal: AbortSignal, onEvent: (type: string, data: unknown) => void) {
  const res = await request(path, { method: 'POST', body, signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const type = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (type && data) onEvent(type, JSON.parse(data));
    }
  }
}
