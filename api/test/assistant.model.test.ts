import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, test } from 'vitest';
import { freeRequestsLeft, ModelError, openRouterModel, type ModelEvent } from '../src/assistant/model.ts';

const servers: { close: () => void }[] = [];
afterEach(() => servers.splice(0).forEach((s) => s.close()));

/** A local stand-in for OpenRouter: each test decides how it answers. */
async function fakeOpenRouter(handle: (req: IncomingMessage, res: ServerResponse, body: string) => void) {
  const requests: { url: string; headers: IncomingMessage['headers']; body: string }[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push({ url: req.url!, headers: req.headers, body });
      handle(req, res, body);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  servers.push({ close: () => { server.closeAllConnections(); server.close(); } });
  return { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`, requests };
}

async function collect(events: AsyncIterable<ModelEvent>) {
  const out: ModelEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}
const request = { messages: [{ role: 'user' as const, content: 'hi' }], tools: [], signal: new AbortController().signal };

test('parses streamed tool-call deltas across chunks', async () => {
  const sse = [
    ': OPENROUTER PROCESSING',
    'data: {"choices":[{"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"aggregate","arguments":""}}]}}]}',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"metric\\":"}}]}}]}',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"salary\\"}"}}]}}]}',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_2","type":"function","function":{"name":"get_employee","arguments":"{\\"code\\":\\"E000001\\"}"}}]}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
    'data: [DONE]',
    '',
  ].join('\n');
  const { baseUrl, requests } = await fakeOpenRouter((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (let i = 0; i < sse.length; i += 37) res.write(sse.slice(i, i + 37)); // split mid-line and mid-JSON
    res.end();
  });
  const model = openRouterModel({ baseUrl, apiKey: 'test-key', models: ['primary/model:free', 'backup/model:free'] });
  expect(await collect(model({ ...request, tools: [{ type: 'function', function: { name: 'aggregate', description: 'd', parameters: {} } }] }))).toEqual([
    { type: 'tool_call', id: 'call_1', name: 'aggregate', args: { metric: 'salary' } },
    { type: 'tool_call', id: 'call_2', name: 'get_employee', args: { code: 'E000001' } },
    { type: 'done' },
  ]);
  expect(requests[0]!.url).toBe('/api/v1/chat/completions');
  expect(requests[0]!.headers.authorization).toBe('Bearer test-key');
  expect(JSON.parse(requests[0]!.body)).toMatchObject({
    model: 'primary/model:free', models: ['primary/model:free', 'backup/model:free'], stream: true, messages: request.messages,
    tools: [{ type: 'function', function: { name: 'aggregate' } }],
  });

  const { baseUrl: textUrl } = await fakeOpenRouter((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: {"choices":[{"delta":{"content":"The median "}}]}\n\ndata: {"choices":[{"delta":{"content":"is 110,000."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  });
  expect(await collect(openRouterModel({ baseUrl: textUrl, apiKey: 'k', models: ['m'] })(request))).toEqual([
    { type: 'token', text: 'The median ' }, { type: 'token', text: 'is 110,000.' }, { type: 'done' },
  ]);
});

const failure = async (events: AsyncIterable<ModelEvent>) => {
  try {
    await collect(events);
  } catch (err) {
    return err;
  }
  return null;
};

test('a 429 becomes rate_limited', async () => {
  const { baseUrl } = await fakeOpenRouter((_req, res) => {
    res.writeHead(429, { 'content-type': 'application/json', 'x-ratelimit-remaining': '0' });
    res.end('{"error":{"code":429,"message":"Rate limit exceeded","metadata":{"error_type":"rate_limit_exceeded"}}}');
  });
  const err = await failure(openRouterModel({ baseUrl, apiKey: 'k', models: ['m'] })(request));
  expect(err).toBeInstanceOf(ModelError);
  expect((err as ModelError).kind).toBe('rate_limited');

  const { baseUrl: midStream } = await fakeOpenRouter((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: {"error":{"code":429,"message":"Rate limit exceeded"},"choices":[{"delta":{},"finish_reason":"error"}]}\n\n');
  });
  expect(((await failure(openRouterModel({ baseUrl: midStream, apiKey: 'k', models: ['m'] })(request))) as ModelError).kind).toBe('rate_limited');
});

test('network error, 5xx and a 60 s timeout become unavailable', async () => {
  const kind = async (cfg: Parameters<typeof openRouterModel>[0], signal = new AbortController().signal) =>
    ((await failure(openRouterModel(cfg)({ ...request, signal }))) as ModelError | null)?.kind;
  expect(await kind({ baseUrl: 'http://127.0.0.1:9/api/v1', apiKey: 'k', models: ['m'] })).toBe('unavailable'); // nothing listens

  const { baseUrl: broken } = await fakeOpenRouter((_req, res) => res.writeHead(502).end('Bad gateway'));
  expect(await kind({ baseUrl: broken, apiKey: 'k', models: ['m'] })).toBe('unavailable');

  const { baseUrl: silent } = await fakeOpenRouter(() => {}); // never answers
  expect(await kind({ baseUrl: silent, apiKey: 'k', models: ['m'], timeoutMs: 200 })).toBe('unavailable');

  const { baseUrl: stalls } = await fakeOpenRouter((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"Thinking"}}]}\n\n'); // then nothing more
  });
  expect(await kind({ baseUrl: stalls, apiKey: 'k', models: ['m'], timeoutMs: 200 })).toBe('unavailable');

  // Stopping on purpose is not a failure of the model: it surfaces as an abort.
  const stop = new AbortController();
  const { baseUrl: slow } = await fakeOpenRouter(() => setTimeout(() => stop.abort(), 50));
  const err = await failure(openRouterModel({ baseUrl: slow, apiKey: 'k', models: ['m'] })({ ...request, signal: stop.signal }));
  expect((err as Error).name).toBe('AbortError');
});

test.fails("reads free requests left from OpenRouter's key info", async () => {
  const { baseUrl, requests } = await fakeOpenRouter((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: { label: 'k', is_free_tier: true, free_model_daily_requests: { used: 13, limit: 50, remaining: 37 } } }));
  });
  expect(await freeRequestsLeft({ baseUrl, apiKey: 'test-key' })).toBe(37);
  expect(requests[0]!.url).toBe('/api/v1/key');
  expect(requests[0]!.headers.authorization).toBe('Bearer test-key');

  const { baseUrl: noField } = await fakeOpenRouter((_req, res) => res.writeHead(200).end('{"data":{"label":"k"}}'));
  expect(await freeRequestsLeft({ baseUrl: noField, apiKey: 'k' })).toBeNull();
  expect(await freeRequestsLeft({ baseUrl: 'http://127.0.0.1:9/api/v1', apiKey: 'k' })).toBeNull();
});
