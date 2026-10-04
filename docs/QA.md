# Manual QA (phase 6)

Test cases for every screen and every rule in `docs/SPEC.md`, run by hand, with the result of
each. Failures are fixed test-first (a red test, then the fix) and the fixing commit is noted.

**Where:** the end-to-end server (`npm run build -w web && node e2e/server.ts`): the built app
on http://localhost:4733, a fresh copy of the 10,000-person seed in `acme_e2e`, and the local
fake OpenRouter (switches in the question: `[429]`, `[500]`, `[no tools]`, `[html]`, `[slow]`;
see `e2e/fake-openrouter.ts`). Sign-in uses the test password in `e2e/env.ts`. Browser: Chrome,
desktop window 1440 px and phone width 390 px, light and dark.

**How run:** *browser* (clicked through in Chrome) · *API* (HTTP calls with curl, signed in
with a session cookie) · *SQL* (queries on `acme_e2e`) · *tests* (covered by automated tests
only; manual QA can't do better, named test listed) · *not run* (with the reason).

**Result:** pass · fail (then fixed, with commits) · not run.

Data changed during the run (so later rows aren't surprised) is listed at the end.

## Screens

Each screen in light and dark, at 1440 and 390 px: layout, wording, long names and large
JPY/INR amounts, loading, empty and error states, reload, and Back.

| # | Screen | What to check | Result | Notes |
|---|---|---|---|---|
| S1 | Sign-in | Layout both themes and widths; wrong password message; Enter submits; signed-out redirect keeps the page | | |
| S2 | Employee list, desktop | Filters, stats line, table columns, sorting arrows, paging, page size, empty state, loading, a bad URL value's message | | |
| S3 | Employee list, phone | Cards, Filters (n) button and drawer, no sideways scroll, Export and Add buttons fit | | |
| S4 | Employee page | Facts, current job and pay, peers line, manager (has-left flag), reports, history newest first, dark mode, long names | | |
| S5 | Edit details dialog | Pre-filled values, messages, save, Escape and Close, Back after closing | | |
| S6 | Change job or pay dialog | Starts from current job, roles follow department, salary currency follows country, scheduled change, messages | | |
| S7 | Mark as leaving / Undo | Future and past leave dates, header and actions while leaving and after leaving, undo | | |
| S8 | Add employee | Suggested code, field order, choices follow each other, messages, success lands on the new page | | |
| S9 | Pay overview | Six countries (widest amounts in JPY and INR), dashes, cell links, phone blocks | | |
| S10 | Import | Instructions, preview with problems, preview clean, import, result link, phone width | | |
| S11 | Assistant | New chat, ask, steps and streaming, Based on, Stop, rename, delete, reload mid-answer, phone list/chat, free requests left | | |
| S12 | Shell | Navigation, active link, burger menu on phone, theme toggle remembered, sign out, skip link | | |
| S13 | Errors | Server unreachable mid-session (stop the server): every screen says so in plain words | | |

## Rules

| Id | How run | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| TIME-1 | API, browser | Hire someone dated tomorrow-in-Tokyo; read status with `X-Timezone` UTC vs Asia/Tokyo; export link has `tz=` | Status follows the header's date; unknown zone → UTC | | |
| AUTH-1 | API | Call each `/api` route group without a cookie | 401 everywhere except sign-in and health | | |
| AUTH-2 | browser, API | Sign in; read the cookie flags; wrong password | httpOnly, SameSite=Lax, 7 days (Secure only in production); "That password isn't right." | | |
| AUTH-3 | API | Six wrong passwords in a row (run last: it locks this IP out for 15 min) | 6th answers 429 "Too many tries. Wait 15 minutes and try again." | | |
| AUTH-4 | browser, API | Sign out; reuse the old cookie | Sign-in page; old cookie gets 401 | | |
| AUTH-5 | browser | Open `/pay?country=DE` signed out, sign in | Back on that page | | |
| AUTH-6 | API, files | Search responses, the server log and the built bundle for the hash, token hashes and key | None found | | |
| LIST-1 | API | Default, 50 and 100 page sizes; total count | 25 by default; total matches | | |
| LIST-2 | browser | Search "muller", "jose", part of an email, part of a code | Accent-blind matches | | |
| LIST-3 | browser | Two countries + one department; default status; add Left | OR within, AND across; leavers only when asked | | |
| LIST-4 | browser | Each sortable column, both directions | Sorted; ties by code | | |
| LIST-5 | browser, API | Salary controls with 0/1/2 countries; API salary sort without one country | Disabled with the note; API 400 with the message | | |
| LIST-6 | browser | Filter, search, sort, page 2; reload; copy link to a new tab; back/forward | Same view each time | | |
| LIST-7 | browser, API | `pageSize=1000`, `country=XX` | 400 naming the value; the page shows it | | |
| LIST-8 | browser | Read a row | Code, name, country, department, role, level, salary with currency, hire date, status | | |
| LIST-9 | browser, SQL | Stats line for a filter; compare a median with SQL | One line per currency; starting people not counted | | |
| LIST-10 | browser | 390 px | Cards, filter drawer, no sideways scroll | | |
| LIST-11 | tests | `npm run measure:list` (Task 19) | p95 ≤ 300 ms (recorded 99–104 ms) | | |
| EMP-1 | browser | Open Add employee | Next free code pre-filled; editable; bad or used code refused | | |
| EMP-2 | browser | Add with every field; currency shown from country | Saved; manager optional | | |
| EMP-3 | browser | Submit empty; then bad values | A message under each field; first invalid field focused | | |
| EMP-4 | browser | Open the new person | Hire change dated on the hire date in history | | |
| EMP-5 | browser, API | Look for edit controls; PATCH code or hire date | Read-only text; API 400 with the message | | |
| EMP-6 | browser | Edit name, gender, email | Saved in place | | |
| EMP-7 | browser | Change before hire date; change with nothing changed; change level only | Refused / refused / saved, other fields kept | | |
| EMP-8 | browser | Role not in department; level outside the role | Refused naming the problem | | |
| EMP-9 | browser | Move country without salary; with salary; move with a later salary scheduled | Refused / saved in new currency / refused naming the later change | | |
| EMP-10 | browser | Manager: self, unknown code, starting person, a report of this person | Each refused in plain words | | |
| EMP-11 | browser | Schedule a change, cancel it; try to cancel a past change | "Cancelled on <date>"; no cancel on past changes | | |
| EMP-12 | SQL, API | `UPDATE`/`DELETE` on job_changes and leave_events; look for edit routes | Database refuses; no route | | |
| EMP-13 | browser | Two tabs on one person; save in one, then in the other | 409 message, typed input kept, Reload works | | |
| EMP-14 | browser | Person with manager who left, reports, scheduled and cancelled changes | All shown as described | | |
| LEAVE-1 | browser | Leave date before hire date; reason over 500 characters; valid | Refused / refused / saved | | |
| LEAVE-2 | browser | Undo leaving | Leave date and reason cleared; both events in history with their dates | | |
| LEAVE-3 | browser, API | Person who has left: page actions; API writes | Only Undo shown; writes refused with the message | | |
| LEAVE-4 | API | `DELETE /api/employees/<code>` | 404 | | |
| LEAVE-5 | browser | Leaving with a later scheduled change; undo | "Won't apply"; applies again after undo | | |
| LEAVE-6 | browser | Default list and stats; add Left to status | Leavers out, then in | | |
| STATS-1 | SQL, browser | One peer group's median by hand vs the page | Same number; per currency only | | |
| STATS-2 | browser | Starting person in a filter | Listed, not counted | | |
| STATS-3 | browser | Pay overview cells, dashes, cell link | As described | | |
| STATS-4 | browser, SQL | A relocated person | Counted in the current country only | | |
| AST-1 | browser | New chat, list order, rename (empty, 81 characters, valid), delete with confirm | As described; title from the first question, 60 characters | | |
| AST-2 | browser | Reload a chat with answers | Questions, answers and sources as saved | | |
| AST-3 | browser | Ask | A step line, then words, then sources | | |
| AST-4 | tests | `assistant.tools.test.ts` (each tool's filters, caps and totals) | — | | Fake model always calls one tool |
| AST-5 | tests | `assistant.tools.test.ts` (bad arguments, unknown tool, read-only transaction, absurd offset) | — | | |
| AST-6 | tests | `assistant.run.test.ts` (six-round cap) | — | | |
| AST-7 | tests | `assistant.run.test.ts` (system prompt content, no secrets) | — | | |
| AST-8 | browser | Click a group link and a person link in Based on | Matching list; the person's page | | |
| AST-9 | browser | Ask with `[no tools]` | "Not based on ACME data" | | |
| AST-10 | not run | Needs the real model and the OpenRouter key | Answer starts "The data can't answer this because…" | | Blocked on the key |
| AST-11 | browser | Ask with `[html]` | Bold, table, list; HTML shown as text; title unchanged | | |
| AST-12 | browser | 2,001 characters; second question while one streams; Stop with `[slow]` | Limit holds; one at a time; partial saved as Stopped | | |
| AST-13 | tests | `assistant.run.test.ts` (last 20 messages) | — | | |
| AST-14 | browser | Ask with `[429]`; then other pages | The free-limit message; question saved; app works | | |
| AST-15 | browser | Ask with `[500]`; then other pages | "The assistant isn't available right now…"; app works | | |
| AST-16 | browser | Look under the question box | "42 free model requests left today" | | |
| AST-17 | browser | Watch network requests while asking | Only localhost:4733 | | |
| AST-18 | tests | `api/test/setup.ts` guard; e2e server uses the fake | — | | |
| CSV-1 | browser | Export a filtered list; open the file | All matching rows, BOM, the listed columns | | |
| CSV-2 | browser | Person named `=SUM(1)`; export | Cell starts with `'` | | |
| CSV-3 | browser | Semicolons, BOM, shuffled columns, upper-case headers, currency column | Accepted | | |
| CSV-4 | browser | File with mistakes | Count, rows as saved, problems by row and column; nothing saved | | |
| CSV-5 | browser | Wrong role for department, bad date, manager in file, manager loop | Problems as for the add form | | |
| CSV-6 | browser | Code used in the database; email twice in the file | Problem on every row involved | | |
| CSV-7 | browser | Import enabled only when clean; import | All saved; result and link | | |
| CSV-8 | browser | Empty file, missing column, an .xlsx file | Plain words, before row checks | | |
| SEED-1 | SQL | Count by hire country | 10,000: US 3000, IN 3000, GB 1200, DE 1200, BR 800, JP 800 | | |
| SEED-2 | tests | `seed.test.ts` (checksum of two runs) | — | | |
| SEED-3 | SQL | Duplicate full names; a few names per country and gender | None; names fit country and gender; Japanese given name first | | |
| SEED-4 | SQL | Code range; duplicate emails | E000001–E010000; none | | |
| SEED-5 | SQL | Latest date anywhere; earliest hire | ≤ 2026-09-30; ≥ 2012-01-01 | | |
| SEED-6 | tests | `seed.test.ts` (medians within ±15% of the research) | — | | |
| SEED-7 | SQL | Women's vs men's median in a large peer group per country | Small gap, varies by country | | |
| SEED-8 | SQL | People beyond 1.8× / 0.55× of their peer median | About 30 | | |
| SEED-9 | SQL | Change kinds present; relocations with new currency; leavers | All present | | |
| SEED-10 | tests, SQL | `seed.test.ts`; spot-check one manager's level | Higher level, employed, no loops | | |
| A11Y-1 | tests | `e2e/a11y.spec.ts` (axe, both themes, both sizes) | — | | |
| A11Y-2 | browser | Keyboard only: sign in, find and open, add, job change, leave and undo, import, ask | All work | | |
| A11Y-3 | browser | Tab through a page; skip link; failed submit | Focus visible; skip works; first invalid field focused | | |
| A11Y-4 | browser | Ask; watch the hidden status line | One "Answer finished." at the end | | |
| UI-1 | browser | Device dark/light; toggle; reload | Follows device; toggle remembered | | |
| UI-2 | browser | Money and dates on every screen | "USD 128,000"; "4 Oct 2026" | | |
| UI-3 | browser | Every screen at 375 and 1440 px | No sideways scroll | | |
| UI-4 | browser | Failed requests on each screen | Plain-word message; nothing silent | | |

## Data changed during the run

(Filled in while running.)
