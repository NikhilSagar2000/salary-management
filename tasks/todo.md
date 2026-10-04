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
- [ ] **Stop: Nikhil approves this plan and picks the execution method**
- [ ] Phase 5: build (tasks 1–29 below)
- [ ] Phase 6: manual QA (test cases for every screen and rule, run, record, fix test-first)
- [ ] Phase 7: deploy after approval, README with set-up, tests and demo-recording script

## Global constraints

- Ports: web 4731 · API 4732 · end-to-end 4733 · Postgres 4734.
- Currencies: US USD · IN INR · GB GBP · DE EUR · BR BRL · JP JPY; never mixed or converted.
- Money: integers (Postgres `bigint`, parsed to JS `number`; max salary 10,000,000,000).
- Dates are calendar dates as `YYYY-MM-DD` strings end to end; the `pg` DATE parser is
  overridden to return strings, never JS `Date`.
- "Today" comes only from `Clock.today()`; tests use `fixedClock('2026-10-01')` unless a test
  needs another date.
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
export type Clock = { today(): string };              // 'YYYY-MM-DD'
export const fixedClock = (date: string): Clock => ({ today: () => date });

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

- [ ] **Task 1: Workspace, database and test harness.** Files: root `package.json`,
  `docker-compose.yml`, `tsconfig.base.json`, `api/src/{app,main,clock,db,migrate}.ts`,
  `api/test/helpers.ts`, `api/test/setup.ts`.
  Tests: `infra.test.ts` › "health answers ok" · "migrations apply once and are recorded" ·
  "dates round-trip unchanged under any server timezone" (review focus 1) ·
  `setup.test.ts` › "test set-up refuses OpenRouter's real base URL" (AST-18).
- [ ] **Task 2: Reference data, shared schemas, formatting.** Files: `shared/src/*`.
  Tests: `shared/test/schemas.test.ts` › "employee schema requires each field with a plain
  message" (EMP-2, EMP-3) · "role must belong to the department and the level be allowed"
  (EMP-2) · "salary accepts only whole numbers from 1 to the maximum, with a plain message for
  separators, decimals, negatives and exponents" (review focus 4) ·
  `shared/test/format.test.ts` › "money shows currency code and separators; dates like
  4 Oct 2026" (UI-2).
- [ ] **Task 3: Sign-in.** Files: `api/src/auth/*`, `scripts/hash-password.ts`, migration for
  `sessions`. Tests: `auth.test.ts` › "rejects /api requests without a session" (AUTH-1) ·
  "signs in with the right password and sets a 7-day httpOnly cookie" · "rejects a wrong
  password with a plain message" (AUTH-2) · "locks sign-in for 15 minutes after 5 wrong
  tries from one IP" (AUTH-3) · "sign-out makes the old cookie stop working" (AUTH-4) · "no
  response or log line contains the password hash, session secret or API key" (AUTH-6).
- [ ] **Task 4: Employee tables and history guards.** Files: `001_init.sql` (or `002_…`).
  Tests: `db.test.ts` › "database refuses changing code or hire date" (EMP-5) · "database
  refuses UPDATE of change fields and any DELETE of history" (EMP-12).
- [ ] **Task 5: Create employee.** Files: `api/src/employees/create.ts`, routes.
  Tests: `employees.create.test.ts` › "suggests the next free code" · "rejects a malformed or
  used code" (EMP-1) · "creates an employee with currency from the country" (EMP-2) ·
  "saves the hire change dated on the hire date" (EMP-4) · "rejects an email already used,
  ignoring case" (EMP-2).
- [ ] **Task 6: Edit personal details with version check.** Tests: `employees.edit.test.ts`
  › "edits first name, last name, gender and email in place" (EMP-6) · "refuses to change code
  or hire date" (EMP-5) · `concurrency.test.ts` › "an old version gets 409 and nothing
  changes" (EMP-13, details; extended in tasks 7–9 to every write).
- [ ] **Task 7: Job changes.** Files: `api/src/employees/{state,changes}.ts`.
  Tests: `history.test.ts` › "a change keeps the fields it doesn't touch" · "a change dated
  before a scheduled one leaves the scheduled one's fields intact" (Q35 example) · "refuses a
  change before hire, after leaving, or changing nothing" (EMP-7) · "refuses a department,
  role and level combination not allowed on that date" (EMP-8) · "a country change needs a
  salary in the new currency" · "refuses a relocation that would leave a later salary in the
  old currency" (EMP-9) · "manager must exist, not be the person, be employed on the date, and
  not form a loop" (EMP-10) · `concurrency.test.ts` › job change case (EMP-13).
- [ ] **Task 8: Cancel scheduled changes.** Tests: `history.test.ts` › "a cancelled scheduled
  change stays in history and stops applying" · "refuses to cancel a change dated today or
  earlier" (EMP-11) · `concurrency.test.ts` › cancel case (EMP-13) · "no route edits a change's
  fields" (EMP-12).
- [ ] **Task 9: Leavers.** Files: `api/src/employees/leave.ts`. Tests: `leave.test.ts` ›
  "marks leaving with a date and optional reason" · "refuses a leave date before hire or a
  reason over 500 characters" (LEAVE-1) · "undo clears date and reason and both events show
  in history" (LEAVE-2) · "refuses every write except undo after leaving" (LEAVE-3) ·
  "DELETE on an employee URL answers 404" (LEAVE-4) · "scheduled changes after the leave date
  stop applying and return on undo" (LEAVE-5) · `concurrency.test.ts` › leave and undo cases (EMP-13).
- [ ] **Task 10: Employee detail.** Tests: `employees.detail.test.ts` › "returns current job,
  peers' stats and position, manager with has-left flag, direct reports and the full
  timeline (changes, scheduled, cancelled, leave, undo)" (EMP-14).
- [ ] **Task 11: Employee list.** Files: `api/src/employees/list.ts`. Tests:
  `employees.list.test.ts` › "returns a page of 25 with the total; 50 and 100 allowed" (LIST-1)
  · "search matches part of name, email or code ignoring case and accents" (LIST-2) · "names
  with apostrophes and hyphens are found" (review focus 2) · "filters combine with AND across
  fields and OR within one" · "default status filter hides people who have left" (LIST-3,
  LEAVE-6) · "sorts by each column both ways, ties broken by code" (LIST-4) · "salary sort and
  range need exactly one country" (LIST-5) · "rejects invalid query values naming the value"
  (LIST-7) · "rows carry current job, salary with currency, hire date and status" (LIST-8) ·
  "no matches gives an empty page, not an error" (review focus 5).
- [ ] **Task 12: Pay statistics.** Files: `api/src/stats/*`. Tests: `stats.test.ts` › "list
  summary gives median, min, max and headcount per currency for the whole filtered set"
  (LIST-9) · "median is percentile_cont rounded half away from zero" · "never combines
  currencies" (STATS-1) · "counts active and leaving, not starting; left only when asked"
  (STATS-2, LEAVE-6) · "overview gives department × level cells for one country" (STATS-3) ·
  "a relocated person counts only in their current country" (STATS-4).
- [ ] **Task 13: Seed.** Files: `api/src/seed/*`, data from `docs/research/pay-bands.md`.
  Seed runs into the test database once per file. Tests: `seed.test.ts` › one test per
  criterion: "exactly 10,000 with the country split" (SEED-1) · "two runs give the same
  checksum" (SEED-2) · "every full name differs and fits country and gender" (SEED-3) · "codes
  E000001–E010000, emails unique" (SEED-4) · "no date after 2026-09-30, hires from 2012"
  (SEED-5) · "group medians within ±15% of the researched bands" (SEED-6) · "women's median below
  men's by the country's gap" (SEED-7) · "about 30 listed outliers and nobody else beyond the
  limits" (SEED-8) · "every person starts with a hire change; raises, promotions, relocations
  with new-currency salaries and leavers exist" (SEED-9) · "managers employed, more senior,
  no loops" (SEED-10). Seed time is measured and logged in JOURNEY section 7.
- [ ] **Task 14: CSV export.** Files: `api/src/csv/export.ts`. Tests: `csv.export.test.ts` ›
  "exports every filtered row with BOM, commas and the documented columns" (CSV-1) ·
  "prefixes formula-like cells with an apostrophe" (CSV-2) · "accented and apostrophe names
  export intact" (review focus 2).
- [ ] **Task 15: CSV import.** Files: `api/src/csv/import.ts`. Tests: `csv.import.test.ts` ›
  "accepts comma or semicolon, BOM, any column order and header case" · "allows the export's
  status and leave columns only when empty" · "refuses files over 5 MB or 10,000 rows" (CSV-3)
  · "quoted commas and line breaks, CRLF and trailing blank lines parse correctly" (review
  focus 3) · "preview lists rows and every problem by line and column, saving nothing"
  (CSV-4) · "applies the add-employee rules, ISO dates, manager from the database or the same
  file" (CSV-5) · "a duplicate code or email in the database or file flags every row involved"
  (CSV-6) · "import saves all rows in one transaction or none, re-checking at commit" (CSV-7)
  · "reports an empty file, missing columns or an unreadable file plainly" (CSV-8).
- [ ] **Task 16: Assistant tools.** Files: `api/src/assistant/tools.ts`. Tests:
  `assistant.tools.test.ts` › "query_employees filters any field, caps at 200 rows and
  reports the total" · "get_employee returns the full history" · "query_changes classifies
  kinds and caps at 200" · "aggregate computes exact stats split by currency" (AST-4) · "bad
  arguments and unknown tools return an error result" · "tool queries run in a read-only
  transaction" · "no tool parameter accepts SQL or free-form expressions" (AST-5).
- [ ] **Task 17: Model client and answer loop.** Files: `api/src/assistant/{model,prompt,run,sources}.ts`.
  The OpenRouter client is tested against a local fake HTTP server. Tests:
  `assistant.run.test.ts` › "streams a step per tool call, then tokens, then sources, then
  done" (AST-3) · "stops tool calls after 6 rounds and asks for an answer" (AST-6) · "system
  prompt lists reference data and today's date and holds no secret" (AST-7) · "sources come
  from the tool calls: groups with filters and headcount, people capped at 20 with a list link"
  (AST-8) · "an answer without tool calls is marked not based on ACME data" (AST-9) · "sends
  at most the last 20 messages" (AST-13) · `assistant.model.test.ts` › "a 429 becomes
  rate_limited" (AST-14) · "network error, 5xx and a 60 s timeout become unavailable"
  (AST-15) · "reads free requests left from OpenRouter's key info" (AST-16) · "parses streamed
  tool-call deltas across chunks".
- [ ] **Task 18: Chats API and streaming route.** Files: `api/src/assistant/routes.ts`.
  Tests: `chats.test.ts` › "creates, lists newest first, renames (1–80 characters) and
  deletes chats" · "titles a new chat with its first question cut to 60 characters" (AST-1) ·
  "a reopened chat returns messages with their saved sources" (AST-2) · "rejects questions
  over 2,000 characters" · "refuses a second answer while one streams" · "stopping saves the
  partial answer as Stopped" (AST-12) · "rate limit keeps the question and saves the
  free-limit message" (AST-14) · "the key is never sent to the browser" (AST-17).
- [ ] **Task 19: List performance.** Files: `scripts/measure-list.ts`. Run against the
  seeded dev database; `npm run measure:list` exits non-zero above 300 ms p95 (LIST-11).
  Results, machine and method go into JOURNEY section 7.
- [ ] **Model smoke test (needs Nikhil's key in `.env`; not part of `npm test`).**
  `npm run smoke:model` checks each candidate free model for streamed tool-call deltas,
  several tool rounds while streaming, and the `models` fallback; picks one per D44 and logs
  the result in JOURNEY. If the key isn't there yet, building continues on the fake model.

### UI (load `design-taste-frontend` first)

- [ ] **Task 20: Web shell.** Vite + Mantine app, routes, API client, sign-in page, theme
  toggle, skip link. Tests: `web/src/test/shell.test.tsx` › "signed-out visit goes to sign-in
  and returns afterwards" (AUTH-5) · "theme follows the device and the toggle is remembered"
  (UI-1) · "a failed request shows a plain message" (UI-4).
- [ ] **Task 21: Employee list page.** Tests: `EmployeeList.test.tsx` › "salary controls are
  disabled with the note unless one country is chosen" (LIST-5) · "search, filters, sort and
  page are read from and written to the URL" (LIST-6) · "rows show the listed columns"
  (LIST-8) · "stats line per currency above the list" (LIST-9) · "no matches shows the empty
  state and no stats" (review focus 5) · "export downloads the current filter" (CSV-1).
- [ ] **Task 22: Employee page and change forms.** Tests: `EmployeeDetail.test.tsx` › "code
  and hire date are read-only" (EMP-5) · "invalid fields show their messages and focus the
  first" (EMP-3, A11Y-3) · "a 409 keeps the typed input and offers Reload" (EMP-13) · "shows
  peers' position, manager flag, reports and the history timeline" (EMP-14) · "cancel appears
  only on scheduled changes" (EMP-11) · "after leaving only Undo is offered" (LEAVE-3) · "save
  button can't submit twice".
- [ ] **Task 23: Add employee page.** Tests: `AddEmployee.test.tsx` › "pre-fills the
  suggested code, editable" (EMP-1) · "role choices follow the department, level choices
  follow the role" (EMP-2) · "shows each field's message next to it" (EMP-3).
- [ ] **Task 24: Pay overview page.** Tests: `PayOverview.test.tsx` › "one country at a time,
  empty cells show —, a cell opens the matching list" (STATS-3).
- [ ] **Task 25: Import page.** Tests: `Import.test.tsx` › "preview shows rows and problems by
  row and column" (CSV-4) · "Import is enabled only with no problems and shows the result"
  (CSV-7).
- [ ] **Task 26: Assistant page.** Tests: `Assistant.test.tsx` › "chat list, rename, and
  delete after confirming" (AST-1) · "model HTML shows as text, never runs" (AST-11) · "Stop
  ends the stream and shows Stopped" (AST-12) · "free requests left are shown when known"
  (AST-16) · "announces once when the answer finishes" (A11Y-4) · "sources link to people and
  filtered lists" (AST-8).

### End to end and CI

- [ ] **Task 27: Playwright flows.** Files: `e2e/playwright.config.ts`,
  `e2e/fake-openrouter.ts`, specs. Server on 4733 against a freshly seeded test database,
  `OPENROUTER_BASE_URL` pointing at the fake. Tests: `auth.spec.ts` › "signed-out visit
  redirects and returns" (AUTH-5) · `list.spec.ts` › "list state survives reload, copied link
  and back/forward" (LIST-6) · `phone.spec.ts` › "at 375 px the list shows cards and a filter
  drawer" (LIST-10) · "no screen scrolls sideways at 375 or 1440 px" (UI-3) ·
  `assistant.spec.ts` › "an answer streams with sources from the fake model" (AST-3) · "rate
  limit message appears and other pages keep working" (AST-14) · "the browser never calls
  openrouter.ai" (AST-17) · `import.spec.ts` › "export, then import new rows with a preview"
  (CSV-1, CSV-4, CSV-7) · `secrets.spec.ts` › "the built web bundle holds no secret" (AUTH-6).
- [ ] **Task 28: Accessibility.** Tests: `a11y.spec.ts` › "no serious or critical axe problems
  on every screen, light and dark, desktop and phone" (A11Y-1) · `keyboard.spec.ts` › one test
  per flow: sign in; search, filter and open; add; job change; leave and undo; import; ask
  (A11Y-2) · "focus is visible, skip link works, errors are announced" (A11Y-3).
- [ ] **Task 29: CI.** `.github/workflows/ci.yml`: Postgres service, `npm ci`, migrate,
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
| AUTH-1 | 3 | EMP-9 | 7 | AST-7 | 17 |
| AUTH-2 | 3 | EMP-10 | 7 | AST-8 | 17, 26 |
| AUTH-3 | 3 | EMP-11 | 8, 22 | AST-9 | 17 |
| AUTH-4 | 3 | EMP-12 | 4, 8 | AST-10 | manual QA |
| AUTH-5 | 20, 27 | EMP-13 | 6–9, 22 | AST-11 | 26 |
| AUTH-6 | 3, 27 | EMP-14 | 10, 22 | AST-12 | 18, 26 |
| LIST-1 | 11 | LEAVE-1 | 9 | AST-13 | 17 |
| LIST-2 | 11 | LEAVE-2 | 9 | AST-14 | 17, 18, 27 |
| LIST-3 | 11 | LEAVE-3 | 9, 22 | AST-15 | 17 |
| LIST-4 | 11 | LEAVE-4 | 9 | AST-16 | 17, 26 |
| LIST-5 | 11, 21 | LEAVE-5 | 9 | AST-17 | 18, 27 |
| LIST-6 | 21, 27 | LEAVE-6 | 11, 12 | AST-18 | 1 |
| LIST-7 | 11 | STATS-1 | 12 | CSV-1 | 14, 21, 27 |
| LIST-8 | 11, 21 | STATS-2 | 12 | CSV-2 | 14 |
| LIST-9 | 12, 21 | STATS-3 | 12, 24 | CSV-3 | 15 |
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
