import { vi } from 'vitest';

type Reply = { status: number; body?: unknown };
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
    const reply = handler ? await handler({ body, headers, url }) : { status: 404, body: { error: 'Not found.' } };
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  });
  return calls;
}
