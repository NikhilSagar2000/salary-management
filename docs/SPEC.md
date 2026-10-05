# ACME Salary Management: acceptance criteria

Every criterion has an id (`AREA-n`). Each one maps to at least one named test in
`tasks/todo.md`. "Today" always means the date in HR's browser timezone (TIME-1), read from
the app clock (tests fix it). Plain-word messages
quoted here are the exact text the app shows, unless marked "e.g.".

## Reference data

**Countries:** US → USD · IN → INR · GB → GBP · DE → EUR · BR → BRL · JP → JPY.

**Departments, roles and allowed levels**

| Department | Role (levels) |
|---|---|
| Engineering | Software Engineer (L1–L7) · Data Engineer (L1–L6) · QA Engineer (L1–L5) · Engineering Manager (L5–L7) |
| Product | Product Manager (L2–L7) |
| Design | Product Designer (L1–L6) |
| Sales | Sales Development Representative (L1–L3) · Account Executive (L2–L6) · Sales Manager (L5–L7) |
| Marketing | Marketing Specialist (L1–L4) · Marketing Manager (L4–L7) |
| Customer Support | Support Specialist (L1–L4) · Support Manager (L4–L6) |
| Finance | Accountant (L1–L5) · Financial Analyst (L1–L6) |
| HR | HR Generalist (L1–L5) · Recruiter (L1–L5) |
| Operations | Operations Analyst (L1–L5) · IT Support Specialist (L1–L4) |

**Peers** of a person: same country, role and level, counted as of today.

**Status** as of today: *starting* (hire date after today) · *active* · *leaving* (leave date
after today) · *left* (leave date today or earlier).

**History model.** A person's job is a list of dated **changes**. Each change records only the
fields it changes (country, department, role, level, manager, salary) plus an optional note.
The state on any date combines all non-cancelled changes dated on or before it, in date order
(same date: the later-entered change wins). The hire change sets every field. A change dated
after today is *scheduled*.

## TIME: whose "today"

- **TIME-1** Every request from the web app carries the browser's IANA timezone (header
  `X-Timezone`, e.g. `Asia/Kolkata`); "today" is the current date there. A missing or unknown
  timezone falls back to UTC. The same instant can be 1 Oct in London and 2 Oct in Tokyo,
  and status, scheduled changes and stats follow the requesting browser's date.

## AUTH: sign-in

- **AUTH-1** Every `/api` route except sign-in and health check answers 401 without a valid session.
- **AUTH-2** The right password starts a session: an httpOnly, SameSite=Lax cookie (Secure in
  production) valid for 7 days. A wrong password answers 401: "That password isn't right."
- **AUTH-3** After 5 wrong passwords from one IP address within 15 minutes, sign-in answers
  429 for 15 minutes: "Too many tries. Wait 15 minutes and try again."
- **AUTH-4** Signing out ends the session; the old cookie no longer works.
- **AUTH-5** Opening any page while signed out goes to the sign-in page, and after signing in
  returns to the page first asked for.
- **AUTH-6** The password hash, session tokens' stored hashes and the OpenRouter key never
  appear in an API response, a log line or the web bundle.

## LIST: find employees

- **LIST-1** `GET /api/employees` returns one page of rows plus the total match count. Page
  size 25 by default; 25, 50 or 100 allowed. Filtering, sorting and paging happen in Postgres.
- **LIST-2** Search matches part of the full name, work email or code, ignoring case and
  accents ("muller" finds "Müller", "jose" finds "José").
- **LIST-3** Filters: country, department, role, level, gender (each multi-select) and status.
  Different filters combine with AND, values within one filter with OR. Default status
  filter: starting, active, leaving. Removing every status shows everyone, leavers included;
  the box stays empty with "All statuses" (P15, D76).
- **LIST-4** Sort by name, code, country, department, role, level or hire date, ascending or
  descending, with ties broken by code.
- **LIST-5** Salary sort and the salary min/max filter work only when exactly one country is
  filtered. Otherwise the API answers 400 ("Choose one country to sort or filter by salary,
  because salaries are in different currencies.") and the UI disables those controls with that note.
- **LIST-6** The URL holds search, filters, sort, page and page size. Reloading, opening a
  copied link, and back/forward all show the same view.
- **LIST-7** Invalid query values (e.g. page size 1000, unknown country) answer 400 with a
  plain message naming the value.
- **LIST-8** Each row shows code, full name, country, department, role, level, current salary
  with its currency, hire date and status.
- **LIST-9** *Removed 2026-10-05 (P7, D71):* the list no longer shows a pay summary. Medians
  are on each employee's page (against peers) and on the pay overview.
- **LIST-10** At 375 px wide, rows show as cards, filters open in a drawer, and the page never
  scrolls sideways.
- **LIST-11** On the seeded database, list requests (search + filters + sort) take at most
  300 ms at the 95th percentile on the dev machine, measured by a script and recorded in JOURNEY.

## EMP: add and change employees

- **EMP-1** The add form pre-fills the next free code (highest code + 1). HR may change it; it
  must look like `E` + 6 digits and be unused.
- **EMP-2** Creating needs: code, first name, last name, gender (female, male, non-binary),
  work email (valid, unused ignoring case), hire date, country, department, role (belongs to
  the department), level (allowed for the role), salary (whole number above 0) and an optional
  manager. Currency comes from the country.
- **EMP-3** Each invalid field shows a plain-word message next to it. The form and the API use
  the same validation rules and messages.
- **EMP-4** Creating saves the person and their hire change dated on the hire date.
- **EMP-5** Code and hire date can't change: the API rejects any attempt (400, "The employee
  code and hire date can't be changed.") and the UI shows them as read-only text.
- **EMP-6** First name, last name, gender and work email are edited in place.
- **EMP-7** A job change has an effective date (not before the hire date, not after the leave
  date) and changes at least one of: country, department, role, level, manager, salary. Fields
  left alone keep their values (history model).
- **EMP-8** Department, role and level must stay a valid combination on the change's date; a
  change that breaks it is refused with a message naming the problem.
- **EMP-9** A change of country must include a salary; the salary's currency is the new
  country's. A change is refused if it would leave any later salary in the wrong currency
  ("A salary change on 1 Jan 2027 is in USD; cancel it before moving this person to Germany.", e.g.).
- **EMP-10** A manager must be an existing employee who is not the person, is not starting
  or left on the change's date, and would not create a reporting loop on that date.
- **EMP-11** Scheduled changes can be cancelled. A cancelled change stays in history marked
  "Cancelled on <date>" and no longer applies. Changes dated today or earlier can't be cancelled.
- **EMP-12** History is never edited or deleted: the API has no route that changes a change's
  fields, and the database refuses `UPDATE` of change fields and any `DELETE` on history.
- **EMP-13** Every write to an employee (details, job change, cancel, leave, undo) sends the
  version the page loaded. If it's out of date the save is refused with 409: "Someone changed
  this employee after you opened the page. Reload to see the latest, then make your change
  again." The form keeps what HR typed and offers a Reload button.
- **EMP-14** The employee page shows current job and pay, peers' median/min/max/headcount with
  where this person sits (e.g. "12% above the median of 48 peers"), the manager (flagged
  "has left" if so), direct reports, and a history timeline: changes (what changed, from →
  to), scheduled changes, cancelled changes, leaving and undo.

## LEAVE: record leavers

- **LEAVE-1** Mark as leaving/left: leave date (not before hire date) and an optional reason
  (up to 500 characters).
- **LEAVE-2** Undo leaving clears the leave date and reason. Both events appear in history
  with their dates.
- **LEAVE-3** While someone has left, every write except undo is refused: "This person has
  left. Undo leaving first to make changes." The UI hides those actions.
- **LEAVE-4** No route deletes an employee; `DELETE` on employee URLs answers 404.
- **LEAVE-5** Scheduled changes dated after the leave date show "won't apply (after leave
  date)" and apply again if leaving is undone.
- **LEAVE-6** People who have left are left out of the list by default (status filter) and out
  of all statistics unless the status filter includes them.

## STATS: pay statistics

- **STATS-1** Median is Postgres `percentile_cont(0.5)` rounded half away from zero; shown with
  min, max and headcount. Stats are always per currency and never combine currencies.
- **STATS-2** Stats count people whose status today is active or leaving; starting people and
  people who have left are not counted.
- **STATS-3** The pay overview shows one country at a time: departments × levels, each cell
  with median, min, max and headcount ("—" when empty). A cell opens the list filtered to
  that country, department and level.
- **STATS-4** A relocated person counts in their current country only.

## AST: pay assistant

Chats
- **AST-1** HR can start a chat, see chats newest first, open one, rename it (1–80
  characters) and delete it after confirming. A new chat is titled with its first question
  cut to 60 characters.
- **AST-2** Reopening a chat shows every question and answer with the sources saved at the time.

Answering
- **AST-3** Sending a question streams the answer (server-sent events): progress steps per
  tool call (e.g. "Looking up pay in US · Engineering…"), then the words, then the sources.
  The steps show only while the answer is worked out; they go away when it finishes, stops or
  fails (P10, D73).
- **AST-4** The model gets data only through these read-only tools:
  - `query_employees`: filters on any employee field (including leavers, hire/leave date
    ranges, salary range only with one country), sort, up to 200 rows per call, plus total.
  - `get_employee`: one person with their full history.
  - `query_changes`: history changes by date range, kind (hire, raise, pay cut, promotion,
    role change, department change, relocation, manager change, leave, undo leave) and
    employee filters; up to 200 rows per call, plus total.
  - `aggregate`: server-computed salary median/min/max/headcount, counts, and raise %
    median over changes, grouped by any of country, department, role, level, gender, status,
    hire year, manager; with filters and an as-of date. Salary results are always split by
    currency.
- **AST-5** No tool takes SQL or free-form expressions; every argument is a typed value checked
  by Zod. Bad arguments or an unknown tool return an error to the model, not a crash. Tool
  queries run in a read-only transaction.
- **AST-6** At most 6 rounds of tool calls per question; then the model must answer from what
  it has.
- **AST-7** The system prompt carries the countries, departments, roles, levels and today's
  date; it holds no secrets. Data from the database (names, reasons, titles) reaches the model
  only as tool results.
- **AST-8** Each answer shows "Based on": groups (their filters and headcount, linking to the
  matching list) and people (code and name, linking to their page; first 20, then "and N more"
  linking to the list). Built by the server from the tool calls made, not from the model's text.
- **AST-9** An answer that used no tool is labelled "Not based on ACME data".
- **AST-10** When the data can't answer, the answer says so plainly, starting "The data can't
  answer this because…" (system prompt rule; checked with the real model in manual QA).
- **AST-11** Answers render as text with simple formatting (bold, lists, tables); any HTML in
  the model's output is shown as text, never run.
- **AST-12** Questions are at most 2,000 characters. Only one answer per chat streams at a
  time. HR can stop an answer; the partial answer is saved marked "Stopped".
- **AST-13** The model receives the chat's last 20 messages at most.

Limits and failures
- **AST-14** When OpenRouter answers 429, the chat shows: "The free AI model limit has been
  reached. Try again later; everything else in the app still works." The question stays saved.
- **AST-15** Other model failures (network error, 5xx, no reply within 60 s) show: "The
  assistant isn't available right now. Try again in a minute." The rest of the app keeps working.
- **AST-16** *Removed 2026-10-05 (P9, D72):* the chat no longer shows how many free model
  requests are left today. `npm run smoke:model` still prints the count for whoever runs it.
- **AST-17** The OpenRouter key is read on the server only; the browser talks only to the app's API.
- **AST-18** No test calls the real model: unit tests inject a scripted model; end-to-end tests
  point the server at a local fake OpenRouter; the test set-up fails if the base URL is
  OpenRouter's.

Layout
- **AST-19** The assistant page fills the window below the top bar: the chat list and the open
  chat's messages scroll separately, and the question box stays in view below the messages
  (P11, D74). Windows shorter than 480 px scroll the whole page instead.

## CSV: Excel round trip

Export
- **CSV-1** Export downloads every row matching the current search and filters (not just the
  page) as UTF-8 CSV with a byte-order mark, comma-separated, columns: code, first_name,
  last_name, gender, work_email, country, department, role, level, salary, currency,
  hire_date, manager_code, status, leave_date, leave_reason.
- **CSV-2** Cells starting with `=`, `+`, `-`, `@`, tab or carriage return are prefixed with
  `'` so Excel doesn't run them as formulas.

Import
- **CSV-3** Import takes a UTF-8 CSV (byte-order mark allowed), comma- or semicolon-separated,
  up to 5 MB and 10,000 rows, with a header row. Required columns: code, first_name,
  last_name, gender, work_email, country, department, role, level, salary, hire_date; optional:
  manager_code, currency (must match the country). The export's status, leave_date and
  leave_reason columns are allowed but must be empty. Column order and header case don't matter.
- **CSV-4** Upload shows a preview: number of rows, the rows as they'll be saved, and every
  problem as row number (file line), column and a plain message (e.g. "Row 14, salary: must be
  a whole number without separators, like 95000"). Nothing is saved at this step.
- **CSV-5** Each row follows the add-employee rules (EMP-1, EMP-2, EMP-10). Dates are
  `YYYY-MM-DD`. A manager_code must be an existing employee or another row in the file.
- **CSV-6** A code or work email already in the database, or appearing twice in the file,
  is a problem on every row involved.
- **CSV-7** "Import" is enabled only when there are no problems. It re-checks everything and
  saves all rows in one transaction; any problem (e.g. a code taken since the preview) saves
  nothing and lists the problems.
- **CSV-8** An empty file, a missing required column or an unreadable file is reported in
  plain words before any row checks.

## SEED

- **SEED-1** The seed creates exactly 10,000 employees: US 3000, IN 3000, GB 1200, DE 1200,
  BR 800, JP 800 (by hire country).
- **SEED-2** Two runs produce identical data (same checksum of a sorted dump of every table).
- **SEED-3** Every full name is different. Each first name comes from the list for the
  person's country and gender (gender-neutral list for non-binary); each last name from the
  country's list. Japanese names are romaji, given name first.
- **SEED-4** Codes run E000001–E010000; work emails are unique.
- **SEED-5** All dates fall on or before 2026-09-30; hire dates from 2012-01-01; no change is
  dated after 2026-09-30.
- **SEED-6** For each country, role and level with at least 20 people, the median salary is
  within ±15% of the researched band in `docs/research/pay-bands.md`.
- **SEED-7** Within the same country, role and level, the median for women is below the median
  for men by a small, country-specific gap taken from the research.
- **SEED-8** About 30 people, picked from peer groups of at least 20, are paid above 1.8× or
  below 0.55× their peer median; the seed lists them, and nobody else is beyond those limits.
- **SEED-9** History looks real: every person starts with a hire change; yearly raises,
  promotions, manager changes, some relocations (with a salary in the new currency) and
  leavers (left before 2026-09-30).
- **SEED-10** Every manager is employed on each date they manage someone, has a higher level
  than their reports, and there are no reporting loops.

## A11Y and UI

- **A11Y-1** axe finds no serious or critical WCAG 2.1 AA problems on any screen, in light
  and dark, at desktop and phone sizes.
- **A11Y-2** Every flow works with the keyboard alone: sign in; search, filter and open an
  employee; add an employee; make a job change; leave and undo; import a CSV; ask a question.
- **A11Y-3** Focus is always visible; a skip link jumps to the main content; on a failed
  submit, focus moves to the first invalid field and errors are read out by screen readers.
- **A11Y-4** A streaming answer announces once when it finishes, not word by word.
- **UI-1** Light and dark themes follow the device setting, with a toggle that is remembered.
- **UI-2** Money shows as currency code plus thousands separators ("USD 128,000"); dates as
  "4 Oct 2026".
- **UI-3** Every screen works from 375 px to 1440 px wide without sideways scrolling.
- **UI-4** Any failed request shows a plain-word message; nothing fails silently.
