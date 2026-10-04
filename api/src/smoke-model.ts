// npm run smoke:model [-- model ...]: checks free OpenRouter models against D44 with the real key from .env.
// Not part of npm test (tests never call the real model, AST-18). Uses the dev database read-only, through the
// assistant's own tools. About five free requests per model; `--data-cant-answer` adds the AST-10 check (two more).
import { systemPrompt } from './assistant/prompt.ts';
import { freeRequestsLeft, openRouterModel, type ModelEvent } from './assistant/model.ts';
import { answerQuestion } from './assistant/run.ts';
import { TOOLS } from './assistant/tools.ts';
import { systemClock, todayIn } from './clock.ts';
import { createPool, DEV_DATABASE_URL } from './db.ts';

const cfg = { baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY ?? '' };
if (!cfg.apiKey) {
  console.error('OPENROUTER_API_KEY is not set in .env.');
  process.exit(1);
}
const args = process.argv.slice(2);
const dataCantAnswer = args.includes('--data-cant-answer');
const named = args.filter((a) => !a.startsWith('--'));
const candidates = named.length
  ? named
  : [process.env.OPENROUTER_MODEL, ...(process.env.OPENROUTER_FALLBACK_MODELS ?? '').split(',')].map((m) => m?.trim()).filter((m): m is string => !!m);
const db = createPool(process.env.DATABASE_URL ?? DEV_DATABASE_URL);
const today = todayIn(systemClock, 'UTC');
const minutes = (ms: number) => AbortSignal.timeout(ms);
const why = (err: unknown) => `${(err as { kind?: string }).kind ?? 'error'}: ${String((err as Error).message ?? err).slice(0, 120)}`;

console.log(`Free requests left today: ${await freeRequestsLeft(cfg)}. Candidates: ${candidates.join(', ')}`);
const rows: string[] = [];
for (const model of candidates) {
  const llm = openRouterModel({ ...cfg, models: [model] });
  let toolCall = '';
  let rounds = '';
  let fallback = '';
  let extra = '';

  // 1. A tool call arrives while streaming.
  try {
    const events: ModelEvent[] = [];
    const messages = [{ role: 'system' as const, content: systemPrompt(today) }, { role: 'user' as const, content: 'How many people work in Engineering in Germany? Look it up.' }];
    for await (const e of llm({ messages, tools: TOOLS, signal: minutes(90_000) })) events.push(e);
    const call = events.find((e) => e.type === 'tool_call');
    toolCall = call && call.type === 'tool_call' ? `pass (${call.name})` : 'FAIL: answered without a tool call';
  } catch (err) {
    toolCall = `FAIL ${why(err)}`;
  }

  // 2. Several tool rounds inside one streamed answer, with the real tools on the dev database.
  try {
    const steps: string[] = [];
    let tokens = 0;
    const answer = await answerQuestion({
      model: llm, db, today, history: [], signal: minutes(180_000),
      question: 'What is the median salary of L3 Software Engineers in Germany and in Brazil, and who is the highest-paid L3 Software Engineer in Germany?',
      onEvent: (e) => (e.type === 'step' ? steps.push(e.text) : e.type === 'token' ? tokens++ : undefined),
    });
    rounds = steps.length >= 2 && answer.text.trim() && tokens > 1
      ? `pass (${steps.length} lookups, ${tokens} streamed pieces): "${answer.text.replace(/\s+/g, ' ').slice(0, 140)}…"`
      : `FAIL (${steps.length} lookups, ${tokens} streamed pieces)`;
  } catch (err) {
    rounds = `FAIL ${why(err)}`;
  }

  // 3. OpenRouter's `models` fallback: the first model doesn't exist, this one should answer.
  try {
    let text = '';
    const viaFallback = openRouterModel({ ...cfg, models: ['acme-smoke/no-such-model:free', model] });
    for await (const e of viaFallback({ messages: [{ role: 'user', content: 'Reply with the word ready.' }], tools: [], signal: minutes(90_000) })) {
      if (e.type === 'token') text += e.text;
    }
    fallback = text.trim() ? 'pass' : 'FAIL: empty reply';
  } catch (err) {
    fallback = `FAIL ${why(err)}`;
  }

  // AST-10 (manual QA): a question the data can't answer.
  if (dataCantAnswer) {
    try {
      const answer = await answerQuestion({
        model: llm, db, today, history: [], signal: minutes(180_000), onEvent: () => {},
        question: 'How much bonus did each engineer in Germany get last year?',
      });
      const text = answer.text.replace(/\s+/g, ' ').trim();
      extra = `\n    AST-10: ${text.startsWith("The data can't answer this because") ? 'pass' : 'FAIL'}: "${text.slice(0, 200)}"`;
    } catch (err) {
      extra = `\n    AST-10: FAIL ${why(err)}`;
    }
  }
  rows.push(`${model}\n    tool call while streaming: ${toolCall}\n    several rounds: ${rounds}\n    models fallback: ${fallback}${extra}`);
  console.log(rows.at(-1));
}
console.log(`Free requests left today: ${await freeRequestsLeft(cfg)}`);
await db.end();
