import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A local stand-in for OpenRouter's chat API, so no end-to-end run reaches the real model (AST-18). A question first gets
 * a streamed `query_employees` call for engineers in Brazil, then a streamed answer; a question containing "[429]" gets
 * OpenRouter's free-limit reply. GET /key reports 42 free requests left.
 */
export async function startFakeOpenRouter(expectedKey: string) {
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const json = (status: number, body: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    if (req.headers.authorization !== `Bearer ${expectedKey}`) return json(401, { error: { code: 401, message: 'No auth credentials found' } });
    if (req.method === 'GET' && req.url === '/api/v1/key') {
      return json(200, { data: { free_model_daily_requests: { used: 8, limit: 50, remaining: 42 } } });
    }
    if (req.method !== 'POST' || req.url !== '/api/v1/chat/completions') return json(404, { error: { code: 404, message: 'Not found' } });

    const { messages } = JSON.parse(raw) as { messages: { role: string; content: string | null }[] };
    const question = messages.findLast((m) => m.role === 'user')?.content ?? '';
    if (question.includes('[429]')) {
      return json(429, { error: { code: 429, message: 'Rate limit exceeded', metadata: { error_type: 'rate_limit_exceeded' } } });
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (delta: unknown) => res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`);
    if (messages.at(-1)?.role !== 'tool') {
      send({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'query_employees', arguments: '{"filters":{"country":["BR"],' } }] });
      send({ tool_calls: [{ index: 0, function: { arguments: '"department":["Engineering"]},"limit":5}' } }] });
    } else {
      for (const words of ['Here are ', 'the engineers ', 'in **Brazil**.']) {
        send({ content: words });
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    res.end('data: [DONE]\n\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`, server };
}
