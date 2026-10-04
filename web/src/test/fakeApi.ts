import { vi } from 'vitest';

/** `events` streams server-sent events chunk by chunk; aborting the request errors the stream, as a real fetch does. */
type Reply = { status: number; body?: unknown; events?: AsyncIterable<string> };
type Handler = (req: { body: unknown; headers: Headers; url: URL }) => Reply | Promise<Reply>;

/** Stubs fetch with a route table keyed "METHOD /path"; records every call. Unlisted routes answer 404. */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: { method: string; url: URL; headers: Headers; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const body = typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init.body;
    calls.push({ method, url, headers, body });
    const handler = routes[`${method} ${url.pathname}`];
    const reply: Reply = handler ? await handler({ body, headers, url }) : { status: 404, body: { error: 'Not found.' } };
    if (reply.events) return new Response(streamOf(reply.events, init.signal), { status: reply.status, headers: { 'content-type': 'text/event-stream' } });
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return calls;
}

function streamOf(events: AsyncIterable<string>, signal?: AbortSignal | null) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener('abort', () => controller.error(new DOMException('The operation was aborted.', 'AbortError')));
      void (async () => {
        for await (const chunk of events) {
          if (signal?.aborted) return;
          controller.enqueue(encoder.encode(chunk));
        }
        if (!signal?.aborted) controller.close();
      })();
    },
  });
}

/** A promise the test opens when it wants a held stream to go on. */
export function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => (open = resolve));
  return { wait, open };
}

/** Server-sent events: strings are sent, promises are waited for. */
export async function* sse(...parts: (string | Promise<void>)[]) {
  for (const part of parts) {
    if (typeof part === 'string') yield part;
    else await part;
  }
}
export const sseEvent = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
