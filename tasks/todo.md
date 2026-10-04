# ACME Salary Management: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans (Nikhil picks at approval). Steps use `- [ ]` checkboxes.

**Goal:** a web app where ACME's HR manager keeps 10,000 employees' pay current and asks a
read-only pay assistant about it, replacing the Excel sheets.

**Architecture:** npm workspaces. `shared/` holds reference data, Zod schemas (one set of
validation rules and messages for forms and API) and formatting. `api/` is an Express app
built by `createApp(deps)` with injected database pool, clock and model, so tests control time
and never reach OpenRouter; in production it also serves the built `web/`. Postgres stores
employees, dated job changes (each holding only what it changes), leave events, sessions and
chats; "state on a date" is computed in SQL. `web/` is React + Mantine.

**Tech stack:** TypeScript · Node 24 · Express · Zod · `pg` · React (Vite) · Mantine · Vitest ·
supertest · Testing Library · Playwright · `@axe-core/playwright` · Docker Compose (Postgres) ·
GitHub Actions.

**Spec:** `docs/SPEC.md` (acceptance criteria) and `docs/REQUIREMENTS.md`. Decisions and
reasons: `docs/JOURNEY.md` section 4.

## Phase tracker

- [x] Phase 1: set-up (commit a12346c)
- [x] Phase 2: brainstorm (Q1–Q36)
- [x] Phase 3: `docs/REQUIREMENTS.md`, `docs/SPEC.md`, pay research
- [x] Phase 4: this plan
- [x] **Stop: Nikhil approved this plan (native execution, step detail just before each task)**
- [x] Phase 5: build (tasks 1–29 below; final review and its fixes; see "Phase 5 review" at the end)
- [x] Phase 6: manual QA (test cases for every screen and rule, run, record, fix test-first)
  - [x] Write `docs/QA.md`: 13 screen cases and one row per criterion (86), each with how it's run
  - [x] Run on the end-to-end server (fresh seed, fake model with QA switches), screen by screen
  - [x] Record pass/fail per row; fix failures test-first and note the commit
  - [x] AUTH-3 last (it locks the IP out); AST-10 waits for the OpenRouter key
- [ ] Phase 7: deploy after approval, README with set-up, tests and demo-recording script

## Global constraints

- Ports: web 4731 · API 4732 · end-to-end 4733 · Postgres 4734.
- Currencies: US USD · IN INR · GB GBP · DE EUR · BR BRL · JP JPY; never mixed or converted.
- Money: integers (Postgres `bigint`, parsed to JS `number`; max salary 10,000,000,000).
- Dates are calendar dates as `YYYY-MM-DD` strings end to end; the `pg` DATE parser is
  overridden to return strings, never JS `Date`.
- "Today" comes only from `todayIn(clock, tz)`, where `tz` is the request's `X-Timezone`
  (UTC if missing or unknown); tests use `fixedClock('2026-10-01T12:00:00Z')` unless a test
  needs another instant.
- Stats: median = `percentile_cont(0.5)` rounded half away from zero, with min, max, headcount.
- Plain-word messages are written once in `shared/src/messages.ts` and quoted from there.
- WCAG AA; full keyboard use; Mantine components keep their built-in ARIA.
- Dependencies beyond the stack need a one-line reason in JOURNEY's decision log. Planned:
  `csv-parse` (import, RFC 4180 quoting), `react-markdown` (assistant text, raw HTML off),
  `@axe-core/playwright`, `supertest`, `@testing-library/react`. Everything else is stdlib.
- **Per-behaviour cycle (every test listed below):**
  1. Write the test using `test.fails(...)` (Vitest) or `test.fail()` (Playwright).
  2. Run the suite; it must pass, which shows the new test fails as expected.
  3. Commit `test(<scope>): <behaviour>` with the JOURNEY line for it.
  4. Remove the marker, write the least code that makes it pass.
  5. Run the whole suite (`npm test`); everything passes.
  6. Commit `feat(<scope>): <behaviour>` (and `refactor(<scope>)` only if needed), JOURNEY updated.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Load `design-taste-frontend` before task 20 and follow it for every UI task.

## Review focus

Inputs the spec doesn't spell out that would most likely hurt HR; each has a test in the
owning task.

1. **Server timezone vs dates.** A hire date saved as `2026-03-01` must come back
   `2026-03-01` whatever the server's `TZ` (Task 1: run under `TZ=America/Los_Angeles` and
   `TZ=Asia/Tokyo`).
2. **Names with accents, apostrophes and hyphens** (`João`, `O'Brien`, `Müller-Lüdenscheidt`)
   must save, search, export and import intact (Tasks 11, 14, 15).
3. **Excel CSV quirks:** quoted fields with commas or line breaks, CRLF line endings,
   trailing blank lines, BOM must parse correctly (Task 15).
4. **Salary typed like a person types it:** `95,000`, `95000.50`, `-1`, `1e6`, blank or
   an extra zero beyond the maximum get a plain message, never a crash or a wrong number (Task 2).
5. **Filters that match nobody** show an empty-state message and no stats line, not an
   error (Tasks 11, 21).

## File structure

```
package.json                 workspaces + scripts (test, dev, build, seed, migrate, measure:list)
docker-compose.yml           postgres:17 on 4734; creates acme and acme_test
tsconfig.base.json
.github/workflows/ci.yml     Task 29
shared/src/reference.ts      countries→currencies, departments, roles with level ranges, genders
shared/src/messages.ts       every plain-word message
shared/src/schemas.ts        Zod: employee create/details, job change, leave, list query, CSV row, chat
shared/src/format.ts         formatMoney, formatDate
api/src/main.ts              reads env, builds deps, listens
api/src/app.ts               createApp(deps): routes, auth guard, error handler, static web in prod
api/src/clock.ts             Clock, systemClock, fixedClock
api/src/db.ts                pool, DATE parser, withTx, readOnlyTx
api/src/migrate.ts           runs db/migrations/*.sql once each
api/db/migrations/001_init.sql   tables, indexes, extensions, history guards
api/src/auth/*.ts            password (scrypt), sessions, rate limit, routes
api/src/employees/state.ts   SQL for state on a date (shared by list, stats, tools)
api/src/employees/*.ts       create, details, changes, cancel, leave, detail, list, routes
api/src/stats/*.ts           summary, peers, overview, routes
api/src/csv/*.ts             export, import (parse + validate + commit), routes
api/src/assistant/*.ts       tools, prompt, model (OpenRouter client), run loop, sources, chats routes
api/src/seed/*.ts            names per country/gender, bands, generator, CLI
api/test/**                  Vitest + supertest, helpers.ts (testApp, makeEmployee, signIn)
web/src/**                   pages, components, api client, theme
e2e/**                       Playwright config, fake OpenRouter server, specs
scripts/measure-list.ts      LIST-11
```

## Key interfaces

```ts
// shared/src/reference.ts
export const CURRENCY = { US: 'USD', IN: 'INR', GB: 'GBP', DE: 'EUR', BR: 'BRL', JP: 'JPY' } as const;
export type Country = keyof typeof CURRENCY; export type Currency = (typeof CURRENCY)[Country];
export const GENDERS = ['female', 'male', 'non_binary'] as const;
export const ROLES: Record<Role, { department: Department; minLevel: number; maxLevel: number }>;

// api/src/clock.ts
export type Clock = { now(): Date };
export const systemClock: Clock;
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
export function todayIn(clock: Clock, tz: string): string;   // 'YYYY-MM-DD' in tz
export function requestTimezone(header: string | undefined): string; // valid IANA or 'UTC'

// api/src/assistant/model.ts
export type ModelEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'done' };
export type ModelFn = (req: { messages: ChatMessage[]; tools: ToolSpec[]; signal: AbortSignal })
  => AsyncIterable<ModelEvent>;                       // throws ModelError('rate_limited' | 'unavailable')
export const openRouterModel = (cfg: { baseUrl: string; apiKey: string; models: string[] }): ModelFn;

// api/src/app.ts
export function createApp(deps: { db: Pool; clock: Clock; model: ModelFn; config: Config }): Express;

// api/test/helpers.ts
export async function testApp(opts?: { today?: string; model?: ModelFn }):
  Promise<{ app: Express; db: Pool; agent: SuperAgentTest /* signed in */ }>;
export async function makeEmployee(db: Pool, overrides?: Partial<NewEmployee>): Promise<{ code: string; version: number }>;
```

## Tasks

Each task lists files, the criteria it delivers, and its tests (file › name). Every test
runs through the per-behaviour cycle above. A detailed step plan with code for each task
is written just before the task starts, from the interfaces that exist at that point.

### Backend

- [x] **Task 1: Workspace, database and test harness.** Files: root `package.json`,
  `docker-compose.yml`, `tsconfig.base.json`, `api/src/{app,main,clock,db,migrate}.ts`,
  `api/test/helpers.ts`, `api/test/setup.ts`.
  Tests: `infra.test.ts` › "health answers ok" · "migrations apply once and are recorded" ·
  "dates round-trip unchanged under any server timezone" (review focus 1) ·
  `clock.test.ts` › "today follows the X-Timezone header, falling back to UTC for a missing
  or unknown zone" (TIME-1) ·
  `setup.test.ts` › "test set-up refuses OpenRouter's real base URL" (AST-18).
- [x] **Task 2: Reference data, shared schemas, formatting.** Files: `shared/src/*`.
  Tests: `shared/test/schemas.test.ts` › "employee schema requires each field with a plain
  message" (EMP-2, EMP-3) · "role must belong to the department and the level be allowed"
  (EMP-2) · "salary accepts only whole numbers from 1 to the maximum, with a plain message for
  separators, decimals, negatives and exponents" (review focus 4) ·
  `shared/test/format.test.ts` › "money shows currency code and separators; dates like
  4 Oct 2026" (UI-2).
- [x] **Task 3: Sign-in.** Files: `api/src/auth/*`, `scripts/hash-password.ts`, migration for
  `sessions`. Tests: `auth.test.ts` › "rejects /api requests without a session" (AUTH-1) ·
  "signs in with the right password and sets a 7-day httpOnly cookie" · "rejects a wrong
  password with a plain message" (AUTH-2) · "locks sign-in for 15 minutes after 5 wrong
  tries from one IP" (AUTH-3) · "sign-out makes the old cookie stop working" (AUTH-4) · "no
  response or log line contains the password hash, session secret or API key" (AUTH-6).
- [x] **Task 4: Employee tables and history guards.** Files: `001_init.sql` (or `002_…`).
  Tests: `db.test.ts` › "database refuses changing code or hire date" (EMP-5) · "database
  refuses UPDATE of change fields and any DELETE of history" (EMP-12).
- [x] **Task 5: Create employee.** Files: `api/src/employees/create.ts`, routes.
  Tests: `employees.create.test.ts` › "suggests the next free code" · "rejects a malformed or
  used code" (EMP-1) · "creates an employee with currency from the country" (EMP-2) ·
  "saves the hire change dated on the hire date" (EMP-4) · "rejects an email already used,
  ignoring case" (EMP-2).
- [x] **Task 6: Edit personal details with version check.** Tests: `employees.edit.test.ts`
  › "edits first name, last name, gender and email in place" (EMP-6) · "refuses to change code
  or hire date" (EMP-5) · `concurrency.test.ts` › "an old version gets 409 and nothing
  changes" (EMP-13, details; extended in tasks 7–9 to every write).
- [x] **Task 7: Job changes.** Files: `api/src/employees/{state,changes}.ts`.
  Tests: `history.test.ts` › "a change keeps the fields it doesn't touch" · "a change dated
  before a scheduled one leaves the scheduled one's fields intact" (Q35 example) · "refuses a
  change before hire, after leaving, or changing nothing" (EMP-7) · "refuses a department,
  role and level combination not allowed on that date" (EMP-8) · "a country change needs a
  salary in the new currency" · "refuses a relocation that would leave a later salary in the
  old currency" (EMP-9) · "manager must exist, not be the person, be employed on the date, and
  not form a loop" (EMP-10) · `concurrency.test.ts` › job change case (EMP-13).
- [x] **Task 8: Cancel scheduled changes.** Tests: `history.test.ts` › "a cancelled scheduled
  change stays in history and stops applying" · "refuses to cancel a change dated today or
  earlier" (EMP-11) · `concurrency.test.ts` › cancel case (EMP-13) · "no route edits a change's
  fields" (EMP-12).
- [x] **Task 9: Leavers.** Files: `api/src/employees/leave.ts`. Tests: `leave.test.ts` ›
  "marks leaving with a date and optional reason" · "refuses a leave date before hire or a
  reason over 500 characters" (LEAVE-1) · "undo clears date and reason and both events show
  in history" (LEAVE-2) · "refuses every write except undo after leaving" (LEAVE-3) ·
  "DELETE on an employee URL answers 404" (LEAVE-4) · "scheduled changes after the leave date
  stop applying and return on undo" (LEAVE-5) · `concurrency.test.ts` › leave and undo cases (EMP-13).
- [x] **Task 10: Employee detail.** Tests: `employees.detail.test.ts` › "returns current job,
  peers' stats and position, manager with has-left flag, direct reports and the full
  timeline (changes, scheduled, cancelled, leave, undo)" (EMP-14).
- [x] **Task 11: Employee list.** Files: `api/src/employees/list.ts`. Tests:
  `employees.list.test.ts` › "returns a page of 25 with the total; 50 and 100 allowed" (LIST-1)
  · "search matches part of name, email or code ignoring case and accents" (LIST-2) · "names
  with apostrophes and hyphens are found" (review focus 2) · "filters combine with AND across
  fields and OR within one" · "default status filter hides people who have left" (LIST-3,
  LEAVE-6) · "sorts by each column both ways, ties broken by code" (LIST-4) · "salary sort and
  range need exactly one country" (LIST-5) · "rejects invalid query values naming the value"
  (LIST-7) · "rows carry current job, salary with currency, hire date and status" (LIST-8) ·
  "no matches gives an empty page, not an error" (review focus 5).
- [x] **Task 12: Pay statistics.** Files: `api/src/stats/*`. Tests: `stats.test.ts` › "list
  summary gives median, min, max and headcount per currency for the whole filtered set"
  (LIST-9) · "median is percentile_cont rounded half away from zero" · "never combines
  currencies" (STATS-1) · "counts active and leaving, not starting; left only when asked"
  (STATS-2, LEAVE-6) · "overview gives department × level cells for one country" (STATS-3) ·
  "a relocated person counts only in their current country" (STATS-4).
- [x] **Task 13: Seed.** Files: `api/src/seed/*`, data from `docs/research/pay-bands.md`.
  Seed runs into the test database once per file. Tests: `seed.test.ts` › one test per
  criterion: "exactly 10,000 with the country split" (SEED-1) · "two runs give the same
  checksum" (SEED-2) · "every full name differs and fits country and gender" (SEED-3) · "codes
  E000001–E010000, emails unique" (SEED-4) · "no date after 2026-09-30, hires from 2012"
  (SEED-5) · "group medians within ±15% of the researched bands" (SEED-6) · "women's median below
  men's by the country's gap" (SEED-7) · "about 30 listed outliers and nobody else beyond the
  limits" (SEED-8) · "every person starts with a hire change; raises, promotions, relocations
  with new-currency salaries and leavers exist" (SEED-9) · "managers employed, more senior,
  no loops" (SEED-10). Seed time is measured and logged in JOURNEY section 7.
- [x] **Task 14: CSV export.** Files: `api/src/csv/export.ts`. Tests: `csv.export.test.ts` ›
  "exports every filtered row with BOM, commas and the documented columns" (CSV-1) ·
  "prefixes formula-like cells with an apostrophe" (CSV-2) · "accented and apostrophe names
  export intact" (review focus 2).
- [x] **Task 15: CSV import.** Files: `api/src/csv/import.ts`. Tests: `csv.import.test.ts` ›
  "accepts comma or semicolon, BOM, any column order and header case" · "allows the export's
  status and leave columns only when empty" · "refuses files over 5 MB or 10,000 rows" (CSV-3)
  · "quoted commas and line breaks, CRLF and trailing blank lines parse correctly" (review
  focus 3) · "preview lists rows and every problem by line and column, saving nothing"
  (CSV-4) · "applies the add-employee rules, ISO dates, manager from the database or the same
  file" (CSV-5) · "a duplicate code or email in the database or file flags every row involved"
  (CSV-6) · "import saves all rows in one transaction or none, re-checking at commit" (CSV-7)
  · "reports an empty file, missing columns or an unreadable file plainly" (CSV-8).
- [x] **Task 16: Assistant tools.** Files: `api/src/assistant/tools.ts`. Tests:
  `assistant.tools.test.ts` › "query_employees filters any field, caps at 200 rows and
  reports the total" · "get_employee returns the full history" · "query_changes classifies
  kinds and caps at 200" · "aggregate computes exact stats split by currency" (AST-4) · "bad
  arguments and unknown tools return an error result" · "tool queries run in a read-only
  transaction" · "no tool parameter accepts SQL or free-form expressions" (AST-5).
- [x] **Task 17: Model client and answer loop.** Files: `api/src/assistant/{model,prompt,run,sources}.ts`.
  The OpenRouter client is tested against a local fake HTTP server. Tests:
  `assistant.run.test.ts` › "streams a step per tool call, then tokens, then sources, then
  done" (AST-3) · "stops tool calls after 6 rounds and asks for an answer" (AST-6) · "system
  prompt lists reference data and today's date and holds no secret" (AST-7) · "sources come
  from the tool calls: groups with filters and headcount, people capped at 20 with a list link"
  (AST-8) · "an answer without tool calls is marked not based on ACME data" (AST-9) · "sends
  at most the last 20 messages" (AST-13) · `assistant.model.test.ts` › "a 429 becomes
  rate_limited" (AST-14) · "network error, 5xx and a 60 s timeout become unavailable"
  (AST-15) · "reads free requests left from OpenRouter's key info" (smoke test; AST-16 removed) · "parses streamed
  tool-call deltas across chunks".
- [x] **Task 18: Chats API and streaming route.** Files: `api/src/assistant/routes.ts`.
  Tests: `chats.test.ts` › "creates, lists newest first, renames (1–80 characters) and
  deletes chats" · "titles a new chat with its first question cut to 60 characters" (AST-1) ·
  "a reopened chat returns messages with their saved sources" (AST-2) · "rejects questions
  over 2,000 characters" · "refuses a second answer while one streams" · "stopping saves the
  partial answer as Stopped" (AST-12) · "rate limit keeps the question and saves the
  free-limit message" (AST-14) · "the key is never sent to the browser" (AST-17).
- [x] **Task 19: List performance.** Files: `api/src/measure-list.ts` (`npm run measure:list`). Run against the
  seeded dev database; `npm run measure:list` exits non-zero above 300 ms p95 (LIST-11).
  Results, machine and method go into JOURNEY section 7.
- [x] **Model smoke test (needs Nikhil's key in `.env`; not part of `npm test`).**
  `npm run smoke:model` checks each candidate free model for streamed tool-call deltas,
  several tool rounds while streaming, and the `models` fallback; picks one per D44 and logs
  the result in JOURNEY. If the key isn't there yet, building continues on the fake model.

### UI (load `design-taste-frontend` first)

- [x] **Task 20: Web shell.** Vite + Mantine app, routes, API client, sign-in page, theme
  toggle, skip link. Tests: `web/src/test/shell.test.tsx` › "signed-out visit goes to sign-in
  and returns afterwards" (AUTH-5) · "theme follows the device and the toggle is remembered"
  (UI-1) · "a failed request shows a plain message" (UI-4) · "every API request sends the browser's
  timezone" (TIME-1).
- [x] **Task 21: Employee list page.** Tests: `EmployeeList.test.tsx` › "salary controls are
  disabled with the note unless one country is chosen" (LIST-5) · "search, filters, sort and
  page are read from and written to the URL" (LIST-6) · "rows show the listed columns"
  (LIST-8) · "stats line per currency above the list" (LIST-9) · "no matches shows the empty
  state and no stats" (review focus 5) · "export downloads the current filter" (CSV-1).
- [x] **Task 22: Employee page and change forms.** Tests: `EmployeeDetail.test.tsx` › "code
  and hire date are read-only" (EMP-5) · "invalid fields show their messages and focus the
  first" (EMP-3, A11Y-3) · "a 409 keeps the typed input and offers Reload" (EMP-13) · "shows
  peers' position, manager flag, reports and the history timeline" (EMP-14) · "cancel appears
  only on scheduled changes" (EMP-11) · "after leaving only Undo is offered" (LEAVE-3) · "save
  button can't submit twice".
- [x] **Task 23: Add employee page.** Tests: `AddEmployee.test.tsx` › "pre-fills the
  suggested code, editable" (EMP-1) · "role choices follow the department, level choices
  follow the role" (EMP-2) · "shows each field's message next to it" (EMP-3).
- [x] **Task 24: Pay overview page.** Tests: `PayOverview.test.tsx` › "one country at a time,
  empty cells show —, a cell opens the matching list" (STATS-3).
- [x] **Task 25: Import page.** Tests: `Import.test.tsx` › "preview shows rows and problems by
  row and column" (CSV-4) · "Import is enabled only with no problems and shows the result"
  (CSV-7).
- [x] **Task 26: Assistant page.** Tests: `Assistant.test.tsx` › "chat list, rename, and
  delete after confirming" (AST-1) · "model HTML shows as text, never runs" (AST-11) · "Stop
  ends the stream and shows Stopped" (AST-12) · "the chat shows no free-request count"
  (AST-16 removed, D72) · "announces once when the answer finishes" (A11Y-4) · "sources link to people and
  filtered lists" (AST-8).

### End to end and CI

- [x] **Task 27: Playwright flows.** Files: `e2e/playwright.config.ts`,
  `e2e/fake-openrouter.ts`, specs. Server on 4733 against a freshly seeded test database,
  `OPENROUTER_BASE_URL` pointing at the fake. Tests: `auth.spec.ts` › "signed-out visit
  redirects and returns" (AUTH-5) · `list.spec.ts` › "list state survives reload, copied link
  and back/forward" (LIST-6) · `phone.spec.ts` › "at 375 px the list shows cards and a filter
  drawer" (LIST-10) · "no screen scrolls sideways at 375 or 1440 px" (UI-3) ·
  `assistant.spec.ts` › "an answer streams with sources from the fake model" (AST-3) · "rate
  limit message appears and other pages keep working" (AST-14) · "the browser never calls
  openrouter.ai" (AST-17) · `import.spec.ts` › "export, then import new rows with a preview"
  (CSV-1, CSV-4, CSV-7) · `secrets.spec.ts` › "the built web bundle holds no secret" (AUTH-6).
- [x] **Task 28: Accessibility.** Tests: `a11y.spec.ts` › "no serious or critical axe problems
  on every screen, light and dark, desktop and phone" (A11Y-1) · `keyboard.spec.ts` › one test
  per flow: sign in; search, filter and open; add; job change; leave and undo; import; ask
  (A11Y-2) · "focus is visible, skip link works, errors are announced" (A11Y-3).
- [x] **Task 29: CI.** `.github/workflows/ci.yml`: Postgres service, `npm ci`, migrate,
  `npm test`, build, Playwright. Runs only after Nikhil approves a push. Verified locally by
  running the same commands in order.

### Manual-QA-only criterion

- **AST-10** (the real model says plainly when the data can't answer): checked in phase 6
  against the real model, within the free quota; the fake-model tests only prove the UI shows
  such an answer.

## Criteria → tests

Every `docs/SPEC.md` id and where it is tested (task number; test names above).

| Criterion | Task(s) | Criterion | Task(s) | Criterion | Task(s) |
|---|---|---|---|---|---|
| TIME-1 | 1, 20 | | | | |
| AUTH-1 | 3 | EMP-9 | 7 | AST-7 | 17 |
| AUTH-2 | 3 | EMP-10 | 7 | AST-8 | 17, 26 |
| AUTH-3 | 3 | EMP-11 | 8, 22 | AST-9 | 17 |
| AUTH-4 | 3 | EMP-12 | 4, 8 | AST-10 | manual QA |
| AUTH-5 | 20, 27 | EMP-13 | 6–9, 22 | AST-11 | 26 |
| AUTH-6 | 3, 27 | EMP-14 | 10, 22 | AST-12 | 18, 26 |
| LIST-1 | 11 | LEAVE-1 | 9 | AST-13 | 17 |
| LIST-2 | 11 | LEAVE-2 | 9 | AST-14 | 17, 18, 27 |
| LIST-3 | 11 | LEAVE-3 | 9, 22 | AST-15 | 17 |
| LIST-4 | 11 | LEAVE-4 | 9 | AST-16 | removed (D72) |
| LIST-5 | 11, 21 | LEAVE-5 | 9 | AST-17 | 18, 27 |
| LIST-6 | 21, 27 | LEAVE-6 | 11, 12 | AST-18 | 1 |
| LIST-7 | 11 | STATS-1 | 12 | CSV-1 | 14, 21, 27 |
| LIST-8 | 11, 21 | STATS-2 | 12 | CSV-2 | 14 |
| LIST-9 | removed (D71) | STATS-3 | 12, 24 | CSV-3 | 15 |
| LIST-10 | 27 | STATS-4 | 12 | CSV-4 | 15, 25, 27 |
| LIST-11 | 19 | AST-1 | 18, 26 | CSV-5 | 15 |
| EMP-1 | 5, 23 | AST-2 | 18 | CSV-6 | 15 |
| EMP-2 | 2, 5, 23 | AST-3 | 17, 27 | CSV-7 | 15, 25, 27 |
| EMP-3 | 2, 22, 23 | AST-4 | 16 | CSV-8 | 15 |
| EMP-4 | 5 | AST-5 | 16 | SEED-1–10 | 13 |
| EMP-5 | 4, 6, 22 | AST-6 | 17 | A11Y-1, A11Y-2 | 28 |
| EMP-6 | 6 | | | A11Y-3 | 22, 28 |
| EMP-7 | 7 | | | A11Y-4 | 26 |
| EMP-8 | 7 | | | UI-1 | 20 |
| | | | | UI-2 | 2 |
| | | | | UI-3 | 27 |
| | | | | UI-4 | 20 |

## Task step plans

Written just before each task starts (Q39). Every behaviour follows the per-behaviour cycle
in Global constraints: run the new test plain first and read the failure, then add the
expected-to-fail marker, run the suite green, commit `test(...)`; then implement, remove the
marker, run `npm test`, commit `feat(...)`.

### Task 1: Workspace, database and test harness

Files: `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `db/init/01-test-db.sql`,
`api/package.json`, `api/tsconfig.json`, `api/vitest.config.ts`, `api/src/{app,main,clock,db,migrate}.ts`,
`api/db/migrations/`, `api/test/{helpers,guard}.ts`, `api/test/setup.ts`.

- [x] Step 1 (chore): npm workspaces (`shared`, `api`; `web` joins in Task 20), Postgres 17 in
  Docker on 4734 with `acme` and `acme_test`, Vitest with `fileParallelism: false` (one shared
  test database), `.env` loaded with Node's `--env-file-if-exists`. API runs on Node 24's built-in
  TypeScript type stripping (no build step for the API).
  Run: `docker compose up -d db && npm test`. Expected: Vitest runs, "No test files found" is
  not an error (`passWithNoTests`).
- [x] Step 2: `infra.test.ts` › "health answers ok": `GET /api/health` → 200 `{ ok: true }`.
- [x] Step 3: `infra.test.ts` › "migrations apply once and are recorded": `migrate(db, dir)` on
  a temporary folder with two `.sql` files, run twice → first run returns both names, second
  returns `[]`, `schema_migrations` has 2 rows, the created table exists.
- [x] Step 4: `infra.test.ts` › "dates round-trip unchanged under any server timezone": with
  `process.env.TZ` set to `America/Los_Angeles`, then `Asia/Tokyo`, `select '2026-03-01'::date`
  returns the string `'2026-03-01'` (without the DATE parser it's a JS `Date`).
- [x] Step 5: `clock.test.ts` › "today follows the X-Timezone header, falling back to UTC for a
  missing or unknown zone": at `2026-10-01T20:00:00Z`, `Asia/Tokyo` → `2026-10-02`,
  `America/Los_Angeles` → `2026-10-01`, `UTC` → `2026-10-01`, `Mars/Base` and missing → UTC date.
- [x] Step 6: `setup.test.ts` › "test set-up refuses OpenRouter's real base URL":
  `assertFakeModel({ OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1' })` throws;
  a local URL or none passes. `test/setup.ts` calls it on `process.env`.
- [x] Task check: `npm test` → all pass; `npm run typecheck` → no errors.

### Task 2: Reference data, shared schemas, formatting

Files: `shared/package.json`, `shared/src/{reference,messages,schemas,format,index}.ts`,
`shared/test/{schemas,format}.test.ts`, `shared/vitest.config.ts`, `shared/tsconfig.json`.
Levels are numbers 1–7 (shown "L3"). Test expectations are hand-written literals, never
imported from `messages.ts`.

- [x] Step 1: `schemas.test.ts` › "employee schema requires each field with a plain message":
  parsing `{}` gives one message per field: code, first name, last name, gender, work email,
  hire date, country, department, role, level, salary.
- [x] Step 2: `schemas.test.ts` › "role must belong to the department and the level be
  allowed": Software Engineer in Sales → "Software Engineer isn't a role in Sales.";
  Sales Development Representative at L5 → "Sales Development Representative goes from L1 to L3."
- [x] Step 3: `schemas.test.ts` › "salary accepts only whole numbers from 1 to the maximum,
  with a plain message for separators, decimals, negatives and exponents": table of inputs
  (`95000`, `'95000'` ok; `'95,000'`, `'95000.50'`, `95000.5`, `-1`, `0`, `'1e6'`, `''`,
  `10000000001`) → literal messages.
- [x] Step 4: `schemas.test.ts` › "dates must be real calendar dates written YYYY-MM-DD":
  `2026-02-30`, `04/10/2026`, `2026-4-1` refused; `2024-02-29` accepted.
- [x] Step 5: `format.test.ts` › "money shows currency code and separators; dates like 4 Oct
  2026": `formatMoney(128000,'USD')` → `USD 128,000`; `formatMoney(1550000,'INR')` →
  `INR 1,550,000`; `formatMoney(6070000,'JPY')` → `JPY 6,070,000`; `formatDate('2026-10-04')`
  → `4 Oct 2026` under any `TZ`.
- [x] Task check: `npm test` and `npm run typecheck` pass.

### Task 3: Sign-in

Files: `api/db/migrations/001_sessions.sql`, `api/src/auth/{password,sessions,routes}.ts`,
`api/src/app.ts` (guard + config), `scripts/hash-password.ts`, `api/test/auth.test.ts`,
`api/test/helpers.ts` (migrate + truncate per test file, `mutableClock`, `signIn`).
Session = random 32-byte token in an httpOnly cookie `acme_session`; Postgres stores only its
SHA-256 and expiry, so no signing secret is needed. Lockout counts live in memory (one server).

- [x] Step 1: "rejects /api requests without a session": `GET /api/session` and
  `GET /api/employees` → 401 `{ error: 'Please sign in.' }`; `/api/health` stays open.
- [x] Step 2: "signs in with the right password and sets a 7-day httpOnly cookie":
  `POST /api/session` → 204, cookie `HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`, then
  `GET /api/session` → 200; Secure only when `production: true`. Session expires after 7 days.
- [x] Step 3: "rejects a wrong password with a plain message": 401 "That password isn't right."
- [x] Step 4: "locks sign-in for 15 minutes after 5 wrong tries from one IP": 6th try (even the
  right password) → 429 "Too many tries. Wait 15 minutes and try again."; 15 minutes later the
  right password works.
- [x] Step 5: "sign-out makes the old cookie stop working": `DELETE /api/session` → 204, old
  cookie → 401.
- [x] Step 6: "no response or log line contains the password hash or API key" (AUTH-6):
  a negative property, so no red commit; proven by a mutation check (temporarily leak the
  hash, watch it fail, revert).
- [x] Task check: `npm test`, `npm run typecheck`.

### Task 4: Employee tables and history guards

Files: `api/db/migrations/002_employees.sql`, `api/test/db.test.ts`.
Tables: `employees` (identity + personal fields, `version`), `job_changes` (dated changes
holding only what they change; `manager_set` marks a change that sets the manager, so "no
manager" is expressible; `currency` must match `country` when both are set; country needs a
salary; `cancelled_at`), `leave_events` (left / undone). Triggers: code and hire date never
change; employees, job changes and leave events are never deleted; a job change's fields never
change, and `cancelled_at` can be set once.

- [x] Step 1: `db.test.ts` › "database refuses changing code or hire date" (EMP-5): updating
  either raises "The employee code and hire date can't be changed."; updating a name works.
- [x] Step 2: `db.test.ts` › "database refuses UPDATE of change fields and any DELETE of
  history" (EMP-12): updating a change's salary, deleting a change, deleting an employee,
  updating or deleting a leave event all fail; setting `cancelled_at` once works, twice fails.
- [x] Task check: `npm test`, `npm run typecheck`.

### Task 5: Create employee

Files: `api/src/employees/{create,routes}.ts`, `api/src/http.ts` (field-error reply),
`api/test/employees.create.test.ts`. Errors answer 400
`{ error: 'Some fields need fixing.', fields: { <field>: <message> } }`. The hire change stores
every field (`manager_set` true; manager rules arrive with Task 7).

- [x] Step 1: "suggests the next free code": none → `E000001`; after `E000123` → `E000124`.
- [x] Step 2: "rejects a malformed or used code": `E12` → schema message; `E000123` twice →
  "E000123 is already used."
- [x] Step 3: "creates an employee with currency from the country": 201 `{ code, version: 1 }`;
  the hire change has currency BRL for country BR.
- [x] Step 4: "saves the hire change dated on the hire date": one change on the hire date
  with country, department, role, level, salary, currency set and `manager_set` true.
- [x] Step 5: "rejects an email already used, ignoring case" → "That work email is already used."
- [x] Task check: `npm test`, `npm run typecheck`.

### Task 6: Edit personal details with version check

Files: `shared/src/schemas.ts` (`employeeDetailsSchema`), `api/src/employees/details.ts`,
routes, `api/test/employees.edit.test.ts`, `api/test/concurrency.test.ts`.
`PATCH /api/employees/:code` with `{ version, firstName?, lastName?, gender?, workEmail? }`;
the update runs `WHERE code = $1 AND version = $2` and bumps `version`.

- [x] Step 1: "edits first name, last name, gender and email in place": 200 `{ code, version: 2 }`,
  values saved, no history row added; an email used by someone else → "That work email is already used."
- [x] Step 2: "refuses to change code or hire date": body with `code` or `hireDate` → 400
  "The employee code and hire date can't be changed.", nothing saved.
- [x] Step 3: `concurrency.test.ts` › "an old version gets 409 and nothing changes" (details):
  second save with version 1 → 409 with the EMP-13 message; unknown code → 404
  "No employee with code E000999."
- [x] Task check: `npm test`, `npm run typecheck`.

### Task 7: Job changes

Files: `api/db/migrations/004_state.sql` (`employee_state(as_of date)`: per employee, the latest
non-cancelled value of each field dated on or before `as_of` and not after their leave date),
`shared/src/schemas.ts` (`jobChangeSchema`), `api/src/employees/changes.ts`, routes,
`api/test/history.test.ts`, `api/test/concurrency.test.ts`.
`POST /api/employees/:code/changes` `{ version, effectiveDate, country?, department?, role?,
level?, managerCode? (null = no manager), salary?, note? }` → 201 `{ code, version }`.
In one transaction: bump `version` (stale → 409), insert the change (salary currency = the
country in force on that date), then re-check every date from the change on (combination valid,
salary currency matches country); the manager is checked on the change's date. Any problem
rolls back and answers 400 with a plain message.

- [x] Step 1: "a change keeps the fields it doesn't touch".
- [x] Step 2: "a change dated before a scheduled one leaves the scheduled one's fields intact" (Q35).
- [x] Step 3: "refuses a change before hire, after leaving, or changing nothing" (EMP-7).
- [x] Step 4: "refuses a department, role and level combination not allowed on that date",
  including one that breaks a later scheduled change (EMP-8).
- [x] Step 5: "a country change needs a salary in the new currency" (EMP-9).
- [x] Step 6: "refuses a relocation that would leave a later salary in the old currency" (EMP-9).
- [x] Step 7: "manager must exist, not be the person, be employed on the date, and not form a
  loop" (EMP-10).
- [x] Step 8: `concurrency.test.ts` job-change case (EMP-13).
- [x] Task check: `npm test`, `npm run typecheck`.

### Task 8: Cancel scheduled changes

Files: `api/src/app.ts` (request "today" from `X-Timezone`; JSON 404 for unknown `/api`
routes), `api/src/employees/changes.ts` (`cancelChange`), routes, `api/test/history.test.ts`,
`api/test/concurrency.test.ts`. `POST /api/employees/:code/changes/:id/cancel` `{ version }`.
Only changes dated after today (in the browser's timezone) can be cancelled; the hire change
never; the timeline is re-checked after cancelling.

- [x] Step 1: "a cancelled scheduled change stays in history and stops applying" (EMP-11).
- [x] Step 2: "refuses to cancel a change dated today or earlier", where "today" follows
  `X-Timezone` (EMP-11, TIME-1 at request level; replaces the Task 11 ruling).
- [x] Step 3: "the hire change can't be cancelled".
- [x] Step 4: `concurrency.test.ts` cancel case (EMP-13).
- [x] Step 5: "no route edits a change's fields": PATCH/PUT/DELETE on a change → 404 JSON (EMP-12).
- [x] Task check: `npm test`.

### Task 9: Leavers

Files: `shared/src/schemas.ts` (`leaveSchema`), `api/src/employees/leave.ts`, routes,
`api/test/leave.test.ts`, `api/test/concurrency.test.ts`.
`POST /api/employees/:code/leave` `{ version, leaveDate, reason? }` and
`POST /api/employees/:code/undo-leave` `{ version }`; each also writes a `leave_events` row.
"Has left" = leave date on or before today (browser timezone).

- [x] Step 1: "marks leaving with a date and optional reason" (LEAVE-1).
- [x] Step 2: "refuses a leave date before hire or a reason over 500 characters" (LEAVE-1).
- [x] Step 3: "undo clears date and reason and both events show in history" (LEAVE-2).
- [x] Step 4: "refuses every write except undo after leaving" (LEAVE-3): details, job change,
  cancel and a second leave answer 409 "This person has left. Undo leaving first to make changes."
- [x] Step 5: "DELETE on an employee URL answers 404" (LEAVE-4).
- [x] Step 6: "scheduled changes after the leave date stop applying and return on undo" (LEAVE-5).
- [x] Step 7: `concurrency.test.ts` leave and undo cases (EMP-13).
- [x] Task check: `npm test`.

### Task 10: Employee detail

Files: `api/src/employees/detail.ts`, `api/src/stats/peers.ts`, routes,
`api/test/employees.detail.test.ts`. `GET /api/employees/:code` →
`{ code, firstName, lastName, gender, workEmail, hireDate, leaveDate, leaveReason, status,
version, current: { country, currency, department, role, level, salary, manager }, peers,
reports, timeline }`. "Current" is the state today (for someone starting: on their hire date).
Peers = same country, role and level, active or leaving today, including the person;
`position` = whole-number % above (+) or below (−) the peer median.
Timeline entries in date order: changes (`changes: [{ field, from, to }]`, `scheduled`,
`cancelled`, `wontApply`) and leave events.

- [x] Step 1: "returns status, current job and pay against peers" (+ unknown code → 404).
- [x] Step 2: "shows the manager with a has-left flag and the direct reports".
- [x] Step 3: "timeline lists each change with from → to, and marks scheduled, cancelled,
  won't-apply and leave events".
- [x] Task check: `npm test`.

### Task 11: Employee list

Files: `api/db/migrations/005_list.sql` (`unaccent` + `pg_trgm`, immutable `f_unaccent`,
trigram index, `current_state(today)` = each person's state today, or on their hire date if
starting), `shared/src/schemas.ts` (`listQuerySchema`, shared with the web URL state),
`api/src/employees/list.ts`, routes, `api/test/employees.list.test.ts`, `api/test/helpers.ts`
(`insertPeople` bulk fixture). `GET /api/employees?q=&country=US,IN&department=&role=&level=
&gender=&status=starting,active,leaving&salaryMin=&salaryMax=&sort=name&dir=asc&page=1&pageSize=25`
→ `{ rows, total, page, pageSize }`. Name sort = last name, then first name; ties by code.

- [x] Step 1: "returns a page of 25 with the total; 50 and 100 allowed" (LIST-1).
- [x] Step 2: "search matches part of name, email or code ignoring case and accents" (LIST-2).
- [x] Step 3: "names with apostrophes and hyphens are found" (review focus 2; `%`/`_` typed literally).
- [x] Step 4: "filters combine with AND across fields and OR within one" (LIST-3).
- [x] Step 5: "default status filter hides people who have left" (LIST-3, LEAVE-6).
- [x] Step 6: "sorts by each column both ways, ties broken by code" (LIST-4).
- [x] Step 7: "salary sort and range need exactly one country" (LIST-5).
- [x] Step 8: "rejects invalid query values naming the value" (LIST-7).
- [x] Step 9: "rows carry current job, salary with currency, hire date and status" (LIST-8).
- [x] Step 10: "no matches gives an empty page, not an error" (review focus 5).
- [x] Task check: `npm test`.

### Task 12: Pay statistics

Files: `api/src/employees/list.ts` (filter builder shared with stats), `api/src/stats/{summary,overview}.ts`,
`api/src/stats/routes.ts`, `api/test/stats.test.ts`. The list response gains
`stats: [{ currency, median, min, max, headcount }]` (one per currency, country order) for the
whole filtered set, counting people per STATS-2 (never starting; left only if the status filter
includes them). `GET /api/pay-overview?country=US` → `{ country, currency, cells: [{ department,
level, median, min, max, headcount }] }` for people active or leaving today.

- [x] Step 1: "list summary gives median, min, max and headcount per currency for the whole filtered set" (LIST-9).
- [x] Step 2: "median is percentile_cont rounded half away from zero" (STATS-1).
- [x] Step 3: "never combines currencies" (STATS-1).
- [x] Step 4: "counts active and leaving, not starting; left only when asked" (STATS-2, LEAVE-6).
- [x] Step 5: "overview gives department × level cells for one country" (STATS-3).
- [x] Step 6: "a relocated person counts only in their current country" (STATS-4).
- [x] Task check: `npm test`.

### Task 13: Seed

Files: `api/src/seed/{random,names,bands,generate,write,cli}.ts`, `api/test/seed.test.ts`.
`generateSeed()` is a pure function of a fixed PRNG seed (mulberry32) → `{ employees, changes,
leaveEvents, outliers }`; `writeSeed(db, seed)` inserts it in batches. Dates are capped at the
anchor 2026-09-30 (D42). Pay: band = researched L3 × level multiplier (Engineering Manager
÷ m(L5)); individual = band × gender factor × truncated log-normal noise; current salary
first, history back-computed. Managers: same country and department, strictly higher level,
employed on every date they manage (reassigned when they leave or a report catches up).
Tests run `generateSeed()` once per file and write it to the test database.

- [x] Step 1: "exactly 10,000 with the country split" (SEED-1).
- [x] Step 2: "two runs give the same checksum" (SEED-2).
- [x] Step 3: "every full name differs and fits country and gender" (SEED-3).
- [x] Step 4: "codes E000001–E010000, emails unique" (SEED-4).
- [x] Step 5: "no date after 2026-09-30, hires from 2012" (SEED-5).
- [x] Step 6: "group medians within ±15% of the researched bands" (SEED-6).
- [x] Step 7: "women's median below men's by the country's gap" (SEED-7).
- [x] Step 8: "about 30 listed outliers and nobody else beyond the limits" (SEED-8).
- [x] Step 9: "every person starts with a hire change; raises, promotions, relocations with
  new-currency salaries and leavers exist" (SEED-9).
- [x] Step 10: "managers employed, more senior, no loops" (SEED-10).
- [x] `npm run seed` loads the dev database; seed time measured for JOURNEY section 7.
- [x] Task check: `npm test`.

### Task 14: CSV export

Files: `api/src/csv/{format,export}.ts`, `api/src/employees/list.ts` (shared filter builder),
routes, `api/test/csv.export.test.ts`. `GET /api/employees.csv?<list query>` → every matching
row (no paging) in list order, `text/csv; charset=utf-8`, BOM, comma-separated, filename
`employees-<today>.csv`. Columns (CSV-1): code, first_name, last_name, gender, work_email,
country, department, role, level (number), salary, currency, hire_date, manager_code, status,
leave_date, leave_reason.

- [x] Step 1: "exports every filtered row with BOM, commas and the documented columns" (CSV-1).
- [x] Step 2: "prefixes formula-like cells with an apostrophe" (CSV-2).
- [x] Step 3: "accented, apostrophe and comma names export intact" (review focus 2; quoting).
- [x] Task check: `npm test`.

### Task 15: CSV import

Files: `api/src/csv/import.ts` (parse → check → save), routes, `api/test/csv.import.test.ts`;
own RFC 4180 parser (D64 replaced `csv-parse`). `POST /api/imports/preview` and
`POST /api/imports`, body = the CSV text (`text/csv`, ≤ 5 MB). Preview → `{ rows, problems }`,
nothing saved. Import → re-runs every check inside one transaction; any problem saves nothing
(400 with the problems), else 201 `{ imported }`. Problems are `{ line, column, message }`
(line = file line, header is line 1). A leading `'` added by the export's formula guard is removed.

- [x] Step 1: "accepts comma or semicolon, BOM, any column order and header case" (CSV-3).
- [x] Step 2: "allows the export's status and leave columns only when empty" (CSV-3).
- [x] Step 3: "refuses files over 5 MB or 10,000 rows" (CSV-3).
- [x] Step 4: "quoted commas and line breaks, CRLF and trailing blank lines parse correctly" (review focus 3).
- [x] Step 5: "preview lists rows and every problem by line and column, saving nothing" (CSV-4).
- [x] Step 6: "applies the add-employee rules, ISO dates, manager from the database or the same file" (CSV-5).
- [x] Step 7: "a duplicate code or email in the database or file flags every row involved" (CSV-6).
- [x] Step 8: "import saves all rows in one transaction or none, re-checking at commit" (CSV-7).
- [x] Step 9: "reports an empty file, missing columns or an unreadable file plainly" (CSV-8).
- [x] Task check: `npm test`.

### Task 16: Assistant tools

Files: `api/src/assistant/tools.ts`, `api/src/db.ts` (`readOnlyTx`), `api/src/employees/list.ts`
(`listFilter` takes the extra tool filters), `api/db/migrations/006_change_log.sql` (view: each
change with the values before it and its kinds), `api/test/assistant.tools.test.ts`.
`runTool(db, today, name, args) → { result, sources }`; `TOOLS` = OpenAI-style function specs
generated from the Zod schemas (`z.toJSONSchema`). Shared employee filters: search, codes,
country, department, role, level, gender, status, hired/left date ranges, salary range (one
country), manager. Sources: `{ kind: 'group', label, query, headcount }` or
`{ kind: 'person', code, name }`.

- [x] Step 1: "query_employees filters any field, caps at 200 rows and reports the total" (AST-4).
- [x] Step 2: "get_employee returns the full history" (AST-4).
- [x] Step 3: "query_changes classifies kinds and caps at 200" (AST-4).
- [x] Step 4: "aggregate computes exact stats split by currency" (AST-4).
- [x] Step 5: "bad arguments and unknown tools return an error result" (AST-5).
- [x] Step 6: "tool queries run in a read-only transaction" (AST-5).
- [x] Step 7: "no tool parameter accepts SQL or free-form expressions" (AST-5).
- [x] Task check: `npm test`.

### Task 17: Model client and answer loop

Files: `api/src/assistant/{model,prompt,run}.ts`, `api/test/assistant.run.test.ts` (scripted
`ModelFn`), `api/test/assistant.model.test.ts` (local fake OpenRouter HTTP server),
`api/test/helpers.ts` (`scriptedModel`).
`answerQuestion({ model, db, today, history, question, signal, onEvent })` streams events
`step | token | sources | done` and returns `{ text, sources, basedOnData }`. Sources:
`{ groups, people (≤ 20), morePeople }`. At most 6 tool rounds, then one call with no tools and
a nudge to answer. The model sees the last 20 earlier messages. `openRouterModel` streams
`/chat/completions` with the `models` fallback list; 429 → `ModelError('rate_limited')`;
network error, 5xx or 60 s without a reply → `ModelError('unavailable')`.

- [x] Step 1: "streams a step per tool call, then tokens, then sources, then done" (AST-3).
- [x] Step 2: "stops tool calls after 6 rounds and asks for an answer" (AST-6).
- [x] Step 3: "system prompt lists reference data and today's date and holds no secret" (AST-7).
- [x] Step 4: "sources come from the tool calls: groups with filters and headcount, people capped at 20 with a list link" (AST-8).
- [x] Step 5: "an answer without tool calls is marked not based on ACME data" (AST-9).
- [x] Step 6: "sends at most the last 20 messages" (AST-13).
- [x] Step 7: model › "parses streamed tool-call deltas across chunks".
- [x] Step 8: model › "a 429 becomes rate_limited" (AST-14).
- [x] Step 9: model › "network error, 5xx and a 60 s timeout become unavailable" (AST-15).
- [x] Step 10: model › "reads free requests left from OpenRouter's key info" (AST-16).
- [x] Task check: `npm test`.

### Task 18: Chats API and streaming route

Files: `api/db/migrations/007_chats.sql`, `api/src/assistant/{chats,routes}.ts`, `api/src/app.ts`
(deps gain `model`; config gains `openRouter: { baseUrl, apiKey }`), `api/src/main.ts`,
`api/test/chats.test.ts`, `api/test/helpers.ts` (`testApp({ model })`, SSE reader).
Routes: `GET/POST /api/chats`, `GET/PATCH/DELETE /api/chats/:id`,
`POST /api/chats/:id/messages` (SSE: `step`, `token`, `sources`, `done`, `error`),
`GET /api/assistant/status` (`{ freeRequestsLeft }`). The question is saved first; the answer
is saved when it ends as `complete`, `stopped` (connection closed; partial text kept) or
`error` (`rate_limited` / `unavailable`, with the plain message). One answer per chat at a time.

- [x] Step 1: "creates, lists newest first, renames (1–80 characters) and deletes chats" (AST-1).
- [x] Step 2: "titles a new chat with its first question cut to 60 characters" (AST-1).
- [x] Step 3: "a reopened chat returns messages with their saved sources" (AST-2, AST-3 over HTTP).
- [x] Step 4: "rejects questions over 2,000 characters" (AST-12).
- [x] Step 5: "refuses a second answer while one streams" (AST-12).
- [x] Step 6: "stopping saves the partial answer as Stopped" (AST-12).
- [x] Step 7: "rate limit keeps the question and saves the free-limit message" (AST-14, AST-15).
- [x] Step 8: "the key is never sent to the browser" (AST-17) and `/api/assistant/status` (AST-16; removed with D72).
- [x] Task check: `npm test`.

### Task 20: Web shell

Files: `web/{package.json,vite.config.ts,tsconfig.json,index.html,postcss.config.cjs}`,
`web/src/{main.tsx,App.tsx,api.ts,theme.ts}`, `web/src/shell/{Layout,SignIn,RequireSession}.tsx`,
`web/src/test/{setup.ts,shell.test.tsx}`. React 19 + Mantine 9 + React Router + Tabler icons;
Vite on 4731 proxies `/api` to 4732. Accent teal, radius "sm", system fonts, light/dark from the
device with a remembered toggle. Every API call goes through `api.ts` (sends `X-Timezone`,
turns errors into plain messages, sends a signed-out user to `/signin?next=…`).

- [x] Step 1 (chore): `web` workspace, Vite, Mantine, Vitest + Testing Library + jsdom; root
  `npm test` runs it; the empty app renders.
- [x] Step 2: "signed-out visit goes to sign-in and returns afterwards" (AUTH-5).
- [x] Step 3: "theme follows the device and the toggle is remembered" (UI-1).
- [x] Step 4: "a failed request shows a plain message" (UI-4).
- [x] Step 5: "every API request sends the browser's timezone" (TIME-1).
- [x] Task check: `npm test`; `npm run build -w web`.

### Task 21: Employee list page

Files: `web/src/pages/EmployeeList.tsx`, `web/src/pages/EmployeeList.test.tsx`, `web/src/App.tsx`.
The page's URL query is the API query (same parameter names), so list state lives in the URL.
Search (debounced), multi-select filters, salary range enabled only for one country, sortable
column headers (`aria-sort`), pagination and page size, the stats line per currency, empty
state, Export link with the current filters, Add employee. Phone: cards instead of the table.

- [x] Step 1: "salary controls are disabled with the note unless one country is chosen" (LIST-5).
- [x] Step 2: "search, filters, sort and page are read from and written to the URL" (LIST-6).
- [x] Step 3: "rows show the listed columns" (LIST-8).
- [x] Step 4: "stats line per currency above the list" (LIST-9).
- [x] Step 5: "no matches shows the empty state and no stats" (review focus 5).
- [x] Step 6: "export downloads the current filter" (CSV-1).
- [x] Task check: `npm test`.

### Task 22: Employee page and change forms

Files: `web/src/pages/EmployeeDetail.tsx`, `web/src/pages/employee/{Timeline,DetailsForm,JobChangeForm,LeaveForm}.tsx`,
`web/src/forms.ts` (shared-schema validation → field messages, focus the first invalid field),
`web/src/pages/EmployeeDetail.test.tsx`, `web/src/test/fixtures.ts` (`detailResponse`).
Forms open in modals; client validation uses the shared Zod schemas, server field errors show
next to the same fields; 409 keeps the input and offers Reload; Save is disabled while saving.

- [x] Step 1: "code and hire date are read-only" (EMP-5).
- [x] Step 2: "shows peers' position, manager flag, reports and the history timeline" (EMP-14).
- [x] Step 3: "invalid fields show their messages and focus the first" (EMP-3, A11Y-3).
- [x] Step 4: "a 409 keeps the typed input and offers Reload" (EMP-13).
- [x] Step 5: "cancel appears only on scheduled changes" (EMP-11).
- [x] Step 6: "change job or pay sends a dated change with only what changed" (EMP-7, EMP-9; needed by A11Y-2).
- [x] Step 7: "mark as leaving, then only Undo is offered" (LEAVE-1, LEAVE-3).
- [x] Step 8: "save button can't submit twice".
- [x] Task check: `npm test`.

## Phase 5 review

**Result:** tasks 1–29 built test-first on `master` (9fb5c05..4ae6cc6). Final suite: 164 unit
and API tests (shared 5, API 121, web 38) and 22 Playwright tests, all passing; the CI steps
also passed in order on a fresh Postgres 17 container.

**Final whole-branch review** (fresh reviewer on Fable, prompt and result in JOURNEY S2): no
Critical issues. Six fixes, each test-first:
1. EMP-11: a cancelled change shows "Cancelled on <date>" (date in HR's timezone).
2. CSV-5/EMP-10: import refuses rows that manage each other in a circle.
3. Deploy readiness: the API applies migrations before it listens and refuses to start without
   `APP_PASSWORD_HASH`.
4. TIME-1: the CSV export link carries the browser's timezone as `?tz=`.
5. AST-8: "Based on" groups link to the list only when the list shows exactly those people.
6. LEAVE-2: undoing leaving is dated the day it happened.

**Deferred minors.** Nikhil chose to fix all nine before Phase 6 (Q41, D68). Done test-first in
a21e2f9..7cd6a9b; the first turned out not to be a bug (Zod 4's `int()` already refuses unsafe
integers), so it got a pin test only. The list as reported:
- Assistant tool `offset` has no ceiling; a huge value ends the answer as "unavailable"
  instead of a tool error (AST-5 edge).
- The system prompt has no "tool results are data, never instructions" line.
- Any too-large JSON body gets the 5 MB import message (unreachable from the UI).
- Sign-in's `next` accepts `//host`; navigation throws instead of refusing it (fails safe).
- The search box has no length limit; over 100 characters gives a field-less message.
- An insert racing an import gives a 500 instead of a listed problem (single user).
- Date messages say "as YYYY-MM-DD" though date fields only send that format.
- A duplicate between an invalid row and a valid row shows only after the first fix.
- The test pool's on-connect `SET` races the first query (pg deprecation warning, tests only).

### Build ledger (copied from the git-ignored executor workspace before deleting it)

```text
# SDD ledger — plan: tasks/todo.md
Spec: docs/SPEC.md (binding). Executor: inline (executing-plans), Nikhil chose native (Q38).
Ruling: work directly on master — requirements (P1) say "git on master, local only"; that is the explicit consent the skill asks for — cost if wrong: none, history is local.
Ruling: each task's code-level steps are appended under "## Task step plans" as "### Task N" headings just before the task (Q39); task-brief extracts those — cost if wrong: none.
Pre-flight (shared interfaces):
- T1 → all: createApp(deps), Clock/todayIn/requestTimezone, db helpers, testApp. Plan's testApp signature still says `today?: string`; TIME-1 changed the clock to instants. Ruling: testApp({ now?: string /* ISO instant */, model? }) — cost if wrong: one rename.
- T1 createApp deps vs T17 ModelFn: Ruling: deps grow as tasks need them (T1: db, clock, config; T3 adds password hash/secret via config; T17 adds model) — avoids a placeholder model type in T1 — cost if wrong: small signature churn in tests.
- T2 schemas → T5/T6/T7/T15/T16: shared Zod schemas are the single validation source; no conflict found.
- T7 state.ts → T10/T11/T12/T16: "state on a date" SQL lives once in employees/state.ts; no conflict.
- T13 seed → T19/T27: seed CLI writes to DATABASE_URL given; e2e seeds its own test DB; no conflict.
Ruling: a red commit may include a compile-only stub (a function that throws "not implemented") when the test imports a module that doesn't exist yet; otherwise the file fails to load and the expected-to-fail marker can't apply — cost if wrong: none, the stub has no behaviour.
Ruling: TIME-1's request-level check moves to Task 11 (status of a person hired "today" follows X-Timezone); Task 1 tests the clock functions — avoids exposing "today" on /health just for a test — cost if wrong: TIME-1 wiring untested until Task 11.
Ruling: Vitest runs test files one at a time (fileParallelism: false) against one test database — simplest isolation; ceiling: slower suite, per-file schemas if it gets slow.
Ruling: Docker already had a `salary-management_pgdata` volume (created 2026-10-01, unknown owner, not readable with the default users). Left it untouched; compose project renamed `acme-salary` so this app gets its own volume — cost if wrong: none; Nikhil told in the report.
Ruling: JOURNEY "same commit" rule — each commit appends one Build-log line in docs/JOURNEY.md section 3; each task's hash range is added by the first commit after the task ends — cost if wrong: a little doc churn.
Task 1: complete (commits 9fb5c05..666d9d9, tests: npm test →    Duration  403ms (import 46%, tests 34%, transform 14%, setup 4%, worker 2%))
Task 2: complete (commits 666d9d9..4d26c93, tests: npm test →    Duration  334ms (import 45%, tests 35%, transform 14%, setup 4%, worker 2%))
Task 3: Ruling: sessions are random 32-byte tokens stored as SHA-256 in Postgres; no SESSION_SECRET (plan/AUTH-6 mention it) — a DB-checked random token needs no signature, and sign-out works by deleting the row — cost if wrong: none.
Task 3: Ruling: negative-property tests (nothing leaks) can't start red; they get a mutation check (introduce the leak, watch the test fail, revert) and a single test(...) commit — cost if wrong: one commit pair fewer.
Task 3: Ruling: the wrong-password branch was written in the sign-in green step (password checking needs both branches), so its test passed first time; proven by mutation (accept every password → test fails), single test(...) commit — cost if wrong: none.
Task 3: complete (commits 4d26c93..8553d82, tests: npm test →    Duration  1.11s (tests 83%, import 11%, transform 4%, setup 1%, worker 1%))
Ruling: migrations are edited in place until the first deploy (only the local dev/test databases have run them; the test DB is reset when that happens); after deploy, changes go in new files only — cost if wrong: a dev DB needs `DROP SCHEMA public CASCADE` + migrate.
Task 4: complete (commits 8553d82..c02694c, tests: npm test →    Duration  1.39s (tests 81%, import 14%, transform 4%, setup 1%, worker 1%))
Task 5: Ruling: Postgres bigint is parsed to JS number (salaries ≤ 1e10 < 2^53; counts) — plan Global constraints already said "parsed to JS number" — cost if wrong: none at these sizes.
Task 5: complete (commits c02694c..723178b, tests: npm test →    Duration  1.94s (tests 75%, import 19%, transform 4%, setup 1%, worker 1%))
Task 6: complete (commits 723178b..9aeba1d, tests: npm test →              at least ~362ms faster with isolate: false — reuses workers across files instead of one per file)
Task 7: Ruling: the Q35 out-of-order test passed on first run (the changed-fields-only design from step 1 already gives it); proven by mutation — replacing employee_state with full-snapshot semantics fails it — single test(...) commit — cost if wrong: none.
Task 7: Ruling: job-change concurrency case passed first run (addChange checks version since step 1); mutation (drop the version condition) made it fail — single test(...) commit. Also fixed a TS parameter property in FieldProblem that Node type stripping rejects (typecheck caught it; vitest did not) — cost if wrong: none.
Task 7: complete (commits 9aeba1d..c521831, tests: npm test →              at least ~402ms faster with isolate: false — reuses workers across files instead of one per file)
Task 8: Ruling: TIME-1 request-level test lands in Task 8 (cancel is the first route using "today"), superseding the earlier move to Task 11 — cost if wrong: none.
Task 8: Ruling: cancel concurrency case passed first run (cancelChange checks version); mutation (ignore version) failed it; concurrency test now has optional `prepare` and reads the live version — single test(...) commit.
Task 8: complete (commits cf6db20..6b0fbc0, tests: npm test →              at least ~407ms faster with isolate: false — reuses workers across files instead of one per file)
Task 9: Ruling: Task 7 test "refuses a change … after leaving" used a past leave date, which LEAVE-3 now (correctly) answers with 409 has-left; moved it to a future leave date (notice period), which is the case EMP-7 covers — cost if wrong: none, both rules are tested.
Task 9: Ruling: leave/undo concurrency cases passed first run (both write with a version check); mutation (ignore version) failed both — single test(...) commit.
Task 9: complete (commits 6b0fbc0..14ab1fd, tests: npm test →              at least ~443ms faster with isolate: false — reuses workers across files instead of one per file)
Task 10: complete (commits 14ab1fd..f2ec394, tests: npm test →              at least ~544ms faster with isolate: false — reuses workers across files instead of one per file)
Task 11: Ruling: "sort by name" = last name, then first name, ties by code (HR convention; display stays "First Last") — cost if wrong: one ORDER BY.
Task 11: Ruling: wildcard escaping was written with search (step 2), so the punctuation test passed first run; mutation (no escaping) made the "%" case fail — single test(...) commit.
Task 11: Ruling: empty-result test passed first run (a query with no matches naturally returns []); mutation (throw on empty) made it fail — single test(...) commit.
Task 11: complete (commits f2ec394..9af9155, tests: npm test →              at least ~526ms faster with isolate: false — reuses workers across files instead of one per file)
Task 12: Ruling: median rounding test passed first run (PAY_STATS was written in Task 10); mutation (double-precision round, which rounds half to even) failed it — single test(...) commit.
Task 12: Ruling: relocation stats test passed first run (stats read current state); mutation (state takes the earliest country/salary) failed it — single test(...) commit.
Task 12: complete (commits 9af9155..7d10431, tests: npm test →              at least ~579ms faster with isolate: false — reuses workers across files instead of one per file)
Task 13: Ruling: seed attribute generation (names, emails, dates, banded pay) is one coherent function written in step 1 (the DB write needs valid rows); later seed tests that pass on first run are mutation-checked and committed as single test(...) commits — cost if wrong: fewer red commits in the seed history.
Task 13: complete (commits 7d10431..0c7a545, tests: npm test →              at least ~648ms faster with isolate: false — reuses workers across files instead of one per file)
Task 14: Ruling: name-quoting test passed first run (quoting came with step 1); mutation (no quoting) failed it — single test(...) commit.
Task 14: complete (commits 0c7a545..d92368e, tests: npm test →              at least ~680ms faster with isolate: false — reuses workers across files instead of one per file)
Task 15: Ruling: replaced csv-parse with a ~35-line RFC 4180 parser (D64) — csv-parse counts a quoted CRLF as two lines, so problem line numbers drifted — cost if wrong: a hand-written parser to maintain (covered by the quirks test).
Task 15: Incident: a chained command ran `npm test; … git commit`, and an earlier test run left in the background kept DB sessions (orphaned after pkill) holding locks, so suites hung or failed. Commit 2cbd604 was re-verified alone: 82 passed + 1 expected fail, so it stands. Rule from now: chain with && only, never two suites at once, check `pgrep -f "vitest run"` and orphaned sessions before a run.
Task 15: Investigation (systematic-debugging): "hanging"/slow test runs (two runs of the seed checksum test at 926,876 and 927,955 ms; a create test at 25 s; docker exec stalling; Postgres showing no active work) — root cause: the Mac was in repeated 'Maintenance Sleep' of 925–926 s on battery (pmset log), so runs froze mid-query. Not a code bug; the earlier "2 failed" were sleep-induced timeouts. Ruling: run test commands under `caffeinate -i` (prevents idle sleep only during the command) — cost if wrong: none. Hypotheses tried and dropped on evidence: stale planner statistics (plans were cheap with or without ANALYZE), lock contention from parallel runs (real once, but not the repeat cause).
Task 15: complete (commits d92368e..88e8207, tests: caffeinate -i npm test →              at least ~1.04s faster with isolate: false — reuses workers across files instead of one per file)
Task 16: complete (commits 88e8207..8d0f613, tests: caffeinate -i npm test →              at least ~1.92s faster with isolate: false — reuses workers across files instead of one per file)
Task 17: Ruling: system prompt test passed first run once fixed (prompt written in step 1); mutation (drop the period after today's date) failed it — single test(...) commit.
Task 17: complete (commits 8d0f613..2d7c754, tests: caffeinate -i npm test →              at least ~994ms faster with isolate: false — reuses workers across files instead of one per file)
Task 18: complete (commits 2d7c754..403e4ae, tests: caffeinate -i npm test →              at least ~1.04s faster with isolate: false — reuses workers across files instead of one per file)
Task 19: Ruling: the measurement script lives in api/src (it imports the app) rather than scripts/ — cost if wrong: none. Measured p95 99–104 ms over 3 runs (limit 300 ms).
Task 19: complete (commits 403e4ae..88e63df, check: npm run measure:list → p95 99/102/104 ms ≤ 300 ms)
Ruling: the API serves the built web app (D33, same origin) from Task 27, where the end-to-end server on 4733 first needs it; dev uses Vite's proxy on 4731 — cost if wrong: Render deploy waits for Task 27.
Ruling: write schemas stay lenient about unknown keys (ignored, not refused); the API refuses the identity fields explicitly and the only client is our UI — cost if wrong: an API caller's stray field is silently ignored.
Ruling (UI, Tasks 20–26): calm, data-dense app UI per Q24 — system font stack, Mantine defaults restyled lightly; one accent colour; tables first. Excluded: cream/off-white page backgrounds, hero sections or marketing layouts, numbered "01/02" section labels, italic accent words in headings, monospace labels, pill-shaped buttons, gradients, decorative illustrations, emoji. Cost if wrong: restyling later.
Ruling (UI): design-taste-frontend §13 says dashboards/data tables are out of its scope and the stack mandates Mantine; applying only its general rules (one accent = teal, one radius scale = Mantine "sm", contrast, light+dark, loading/empty/error states, no em-dash or emoji, Tabler icons). Design read: internal HR data tool, calm data-dense, Mantine. Dials: variance 3, motion 2, density 7. Cost if wrong: restyle.
Task 20: Ruling: seed tests get a 60 s per-test timeout — the checksum test reseeds 10,000 people (3 s idle, 7 s when the laptop is throttled) and a timeout left the tables half-written, failing the later seed tests — cost if wrong: none.
Task 20: Investigation 2: a full run hung again with no host sleep. Evidence: the seed test's first query ("country split") active on CPU for 622 s with no wait event, every later session queued behind its locks and the next TRUNCATE. Stale-statistics hypothesis tested twice and NOT reproduced (plans stay cheap even with tiny-table stats). Root cause unconfirmed. Ruling: mitigations + diagnostics — test connections get statement_timeout 60 s (a runaway fails with its SQL instead of stalling everything), Postgres logs plans of statements over 20 s (auto_explain), writeSeed ANALYZEs after its bulk load. Correction to the earlier ruling: the first 926 s stalls matched host sleep, but sleep may not explain all of them — cost if wrong: an unexplained slow query may recur, now visible in logs.
Task 20: complete (commits a65d523..e221b2d, tests: caffeinate -i npm test →    Duration  4.94s (import 32%, tests 29%, environment 25%, transform 9%, setup 4%))
Task 21: Ruling: web tests get a 15 s timeout (Mantine in jsdom with simulated typing is slow); URL-state test passed first run (built in step 1), mutation (sort never descending) failed it — single test(...) commit.
Task 21: Ruling: export-link test passed first run (built in step 1); mutation (keep the page parameter) failed it — single test(...) commit.
Task 21: complete (commits e221b2d..9abe0df, tests: caffeinate -i npm test →    Duration  4.11s (tests 54%, environment 19%, import 18%, setup 4%, transform 4%))
Task 22: Ruling: added steps for the job-change form and the leave form (the plan listed their rules but no UI test; A11Y-2 keyboard flows need them) — cost if wrong: none.
Task 22: Ruling: double-submit test passed first run (guard + loading button since step 3); mutation (remove both) failed it — single test(...) commit.
Task 22: complete (commits 9abe0df..47a91e0, tests: caffeinate -i npm test →    Duration  4.59s (tests 65%, environment 15%, import 13%, transform 4%, setup 3%))
Task 21/22 follow-up (visual check): phone filter drawer (LIST-10) red eb84ff5 → green 4eecdf5; skip link fully hidden until focused.
Task 23: Ruling: Person fields ordered names → email → code + hire date (the two fixed fields together); the test's focus expectation (First name first) set the order — cost if wrong: a layout swap.
Task 23: Ruling: last code-error check loosened from exact to 'contains' (the code field also has help text) — cost if wrong: none.
Task 23: complete (commits 4eecdf5..3eb1db7, tests: caffeinate -i npm test →    Duration  5.32s (tests 64%, environment 16%, import 14%, transform 3%, setup 3%))
Task 24: Ruling: the department × level table shows from 1200 px (lg) up; narrower screens get one block per department — seven level columns with INR/JPY amounts don't fit beside the nav below that, and UI-3 forbids sideways scrolling — cost if wrong: tablets see blocks instead of the grid.
Task 24: complete (commits 8d7eaaa..4893829, tests: caffeinate -i npm test →    Duration  5.66s (tests 60%, environment 16%, import 16%, transform 4%, setup 3%))
Task 25: Ruling: the preview table shows the first 100 rows with a 'Showing the first 100 of N' note — rendering 10,000 rows at once is slow on a phone; every problem is still listed — cost if wrong: HR scrolls a CSV to check rows 101+.
Task 25: Ruling: the file picker is a native labelled input (not Mantine FileInput, whose button can't be driven by userEvent.upload or linked to its label) — cost if wrong: plainer look.
Task 25: complete (commits 5342b43..9a1b3f9, tests: caffeinate -i npm test →    Duration  6.28s (tests 57%, import 18%, environment 17%, transform 5%, setup 3%))
Task 26: Ruling: the planned HTML-to-text remark plugin was dropped — react-markdown 10 already shows raw HTML as text (test passed without it); image blocking stays (removing it fails the test) — cost if wrong: none, the test pins the behaviour.
Task 26: Ruling: added test 'the first question names the chat' (bug found in the visual check) — red 051892f, green after — cost if wrong: none.
Task 26: Found: the dev database lacked 007_chats.sql; the API doesn't migrate on start, so deploy must run `npm run migrate` before start (Phase 7). Ran it on the local dev DB.
Task 26: Found (deferred to final review): API tests print pg's "client.query() when the client is already executing a query" deprecation (17 times); pre-existing, source not yet traced.
Task 26: complete (commits 3c5cc59..ff057e3, tests: caffeinate -i npm test →    Duration  4.74s (tests 51%, import 21%, environment 19%, transform 5%, setup 4%))
Task 27: Ruling: end-to-end database is a separate acme_e2e, dropped and recreated from the seed on every run (name must end in _e2e or the script refuses) — acme_test is truncated by Vitest and would race — cost if wrong: none, local only.
Task 27: Ruling: the fake OpenRouter listens on a random local port inside the end-to-end server process (no fifth fixed port) — cost if wrong: none.
Task 27: Ruling: specs passed first run once test mechanics were fixed (exact 'Password' label, exact 'Employees' list, a pick() helper for Mantine multi-selects, polling instead of networkidle, the import file's duplicate email that CSV-6 rightly flagged); one planted break per spec failed all 9 specs, then web/src restored — single test(...) commit.
Task 27: complete (commits b82dce7..19c0e7a, tests: bash -c 'caffeinate -i npm test && caffeinate -i npm run e2e' →   10 passed (20.6s))
Task 28: Ruling: the accent moved from Mantine's default teal shade (6 light, 8 dark) to shade 9 in both themes, dimmed text darkened, tinted-variant text darkened 35% — needed for 4.5:1 (A11Y-1); D65's look stays teal — cost if wrong: a slightly deeper teal.
Task 28: Ruling: keyboard specs passed once mechanics were fixed (locale-dependent date part order handled by a probe-and-type helper; transition-aware focus check; wait for the page before the first Tab); planted breaks failed each — single test(...) commit.
Task 28: Found: native date fields show parts in the OS locale's order while our messages say "YYYY-MM-DD"; HR types in their own locale's order, which is fine, but the message wording assumes the ISO form a person never types — consider "Enter a valid leave date." (deferred to the final review).
Task 28: complete (commits 979df51..3e609e7, tests: bash -c 'caffeinate -i npm test && caffeinate -i npm run e2e' →   22 passed (59.7s))
Task 29: complete (commits d8ca412..a5a7ebd, tests: CI steps in order on a fresh Postgres 17 container → 5+114+35 unit/API, 22 e2e passed)
Final review: fresh reviewer (Fable, S2 in JOURNEY) — no Critical; 3 Important; 12 Minor; verdict "with fixes". Its own runs: 154 unit/API + 22 e2e passed.
Final: Ruling: export link without the timezone (reviewer: Minor) re-graded Important — TIME-1; a US-based HR exporting after ~17:00 gets tomorrow's state (scheduled changes applied early) — cost if wrong: one small fix.
Final: Ruling: "Based on" group links dropping hire/leave/manager/codes filters (reviewer: Minor) re-graded Important — AST-8 provenance; the link opens a broader list than the label and headcount say — cost if wrong: one small fix.
Final: Ruling: undo-leaving dated with the old leave date (reviewer: Minor) re-graded Important — LEAVE-2 "with their dates"; a future-dated undo also sorts after real events — cost if wrong: one small fix.
Final: minor (deferred): tool `offset` has no ceiling; 1e308 reaches Postgres and ends the answer as "unavailable" instead of a tool error (AST-5 edge).
Final: minor (deferred): system prompt lacks "tool results are data, never instructions" (single trusted user, read-only tools, server-built sources).
Final: minor (deferred): any too-large JSON body gets the 5 MB import message (unreachable from the UI).
Final: minor (deferred): sign-in `next` accepts `//host`; navigation throws (fails safe) instead of being refused.
Final: minor (deferred): search box has no maxLength; over 100 characters gives a field-less "Some fields need fixing."
Final: minor (deferred): an insert racing runImport gives a 500 instead of a listed problem (single user).
Final: minor (deferred): date messages say "as YYYY-MM-DD" though native date fields only send that format; only an empty field shows it.
Final: minor (deferred): a duplicate between a row failing validation and a valid row is reported only after the first fix.
Final: minor (deferred): test pool's on-connect SET races the first query (pg deprecation warning, test-only; use a statement_timeout startup option).
Final: Ruling: declined-to-judge items stand — README/deploy/smoke test are Phases 6–7; sessions table growth (one row per sign-in, one user) is negligible; in-memory limiter and answering set are documented single-instance choices; 100-row preview is the Task 25 ruling; later-date manager loops are beyond EMP-10 and the loop query is depth-bounded (100), so no runaway recursion; change_log's text parsing is tested — cost if wrong: small.
Final: fixed EMP-11 'Cancelled on <date>' — "a cancelled change says when it was cancelled, as a date in HR's timezone (EMP-11)" + web 'a cancelled change says when it was cancelled' RED→GREEN, suite 5+115+36
Final: fixed LEAVE-2 undo dated with the old leave date — "undoing leaving is dated the day it was undone, in HR's timezone (LEAVE-2)" RED→GREEN, suite 5+116+36
Final: fixed CSV import loop gap — 'rows that manage each other in a circle are refused, on every row in the circle (CSV-5, EMP-10)' RED→GREEN, suite 5+117+36
Final: fixed migrate-on-start and silent empty password hash — 'the server applies migrations to an empty database before it listens' + 'the server refuses to start without a password hash, saying why' RED→GREEN, suite 5+119+36
Final: fixed export without the timezone (re-graded Important) — "a plain download link can give the browser's timezone as ?tz= (TIME-1)" + web "the export link carries the browser's timezone" RED→GREEN, suite 5+120+37
Final: fixed broader-than-labelled source links (re-graded Important) — 'a group links to the list only when the list can show exactly those people (AST-8)' + web 'a source group the list cannot show is named without a link' RED→GREEN, suite 5+121+38
```

## Phase 6 review

99 QA cases in `docs/QA.md` (13 screens, 86 rules): 87 pass, 12 failed and were fixed
test-first, none left open; summary and rulings at the top of that file. The model smoke test
ran with Nikhil's key (D44: apodex/apodex-1.1-mini:free kept as primary; failover unverified).
Suites after phase 6: 188 unit and API tests (shared 6, API 135, web 47) and 25 Playwright tests.

