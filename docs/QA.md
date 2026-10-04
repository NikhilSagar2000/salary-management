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

## Summary (2026-10-05)

99 cases (13 screens, 86 rules): **87 pass, 12 failed and were fixed test-first, 0 left
open.** AST-10 ran against the real model once Nikhil added the key. Fixes made during QA:
bad list addresses showed a vague message (LIST-5, LIST-7), country sorted by code (LIST-4),
refusals without a field lost their message (UI-4), a starting person's hire offered Cancel,
leave history read as if an undone leave would happen (LEAVE-2), leavers were compared with
today's peers (EMP-14), a long email overlapped at 390 px, page buttons wrapped on a phone,
form messages stayed after a fix, job-change levels ignored the role, the chat didn't scroll
to new messages, Stop also sent the waiting question (AST-12), and narration before a lookup
came before "The data can't answer this because…" (AST-10). The real-model smoke test also
found that badly shaped tool arguments crashed the answer (AST-5), and an end-to-end run
caught a crash introduced by one of the fixes (both fixed).

Rulings, not fixed: rows from the previous search stay without a sign while the next search
loads (about 0.1 s); cancelling a scheduled change takes one click with no confirmation (the
change can be entered again); a cancelled change's "from" value is worked out against today's
history, so it can change later; Chrome's own password pop-up can swallow the first Enter on
sign-in.

## Screens

Each screen in light and dark, at 1440 and 390 px: layout, wording, long names and large
JPY/INR amounts, loading, empty and error states, reload, and Back.

| # | Screen | What to check | Result | Notes |
|---|---|---|---|---|
| S1 | Sign-in | pass | Dark (device) at 1440: layout fine; wrong password → "That password isn't right."; Enter submits (once Chrome's own password pop-up is closed, it eats the first Enter); next kept |
| S2 | Employee list, desktop | pass | Dark and light at desktop: filters, stats lines, sortable headers, paging, empty state with Clear filters, loading skeleton. Found: rows from the previous search stay without any sign while the next loads (about 0.1 s; ruling: leave) |
| S3 | Employee list, phone | fail → fixed | Cards, Filters button and drawer, no sideways scroll. Page buttons wrapped at 390; now fewer siblings on a phone (e9733d3 → 99de1ae, e2e phone.spec) |
| S4 | Employee page | fail → fixed | (1) long email now wraps (99de1ae); (2) a leaver shows "Last job" and "Not compared…" (b54cc9e → d805b00); (3)+(4) leave events read Left / Leaves / Leave cancelled (c19f56a → 7921b21); (5) a starting person's hire reads Starts with no Cancel (9354529 → e0a3001) and field-less refusals carry their own message (9a4f273 → 88598e3). Rechecked at 390 (E000003) and in Chrome (E000010) |
| S5 | Edit details dialog | pass | Pre-filled, case-blind email clash message, save, Escape closes |
| S6 | Change job or pay dialog | fail → fixed | Starts from the current job; messages under the right fields; scheduled change and cancel work. The level list ignored the role; now follows it (26084d7 → f343729) |
| S7 | Mark as leaving / Undo | pass | Leave before hire refused; leaving 15 Nov 2026 with a reason; header shows Leaving and Undo; a scheduled change after it shows Won't apply; undo restores it; someone who has left shows only Undo and the explanation |
| S8 | Add employee | fail → fixed | Layout, choices follow each other, messages, success lands on the new page. Corrected fields kept their red message; now a field drops it when changed (f681686 → c0ed542) |
| S9 | Pay overview | pass | 1440 light: US and JP (widest amounts) fit; 390 dark: one block per department for IN; cell link works |
| S10 | Import | pass | Instructions, previews, import and result at 1440; 390 dark screenshot fine (the native file button is plain but readable) |
| S11 | Assistant | fail → fixed | All flows work. Chat not scrolling to new messages fixed (d3b458f → 0e8c57b; a crash this caused when leaving a chat, found by e2e, fixed in 990d791); Stop also submitting fixed (99de1ae). Rechecked in Chrome: the streaming answer stays above the question box |
| S12 | Shell | pass | Menu with the active page highlighted, theme toggle, sign out; header fits at 390 with the menu button |
| S13 | Errors | pass | Server stopped: Pay overview, Assistant and Employees each show "Can't reach the server. Check your connection and try again." |

## Rules

| Id | How run | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| TIME-1 | API, browser | Hire someone dated tomorrow-in-Tokyo; read status with `X-Timezone` UTC vs Asia/Tokyo; export link has `tz=` | pass | API: hire dated today in Kiritimati is active there, starting in Pago Pago, UTC rules for unknown/missing zones; export link carries tz= (fixed in phase 5) |
| AUTH-1 | API | Call each `/api` route group without a cookie | pass | API: 12 routes 401 signed out; health 200 (e2e/qa-api.ts) |
| AUTH-2 | browser, API | Sign in; read the cookie flags; wrong password | pass | API: cookie HttpOnly, SameSite=Lax, Max-Age 604800, no Secure outside production; browser: wrong password message |
| AUTH-3 | API | Six wrong passwords in a row (run last: it locks this IP out for 15 min) | pass | API: wrong passwords 1–5 → 401, 6th → 429 "Too many tries. Wait 15 minutes and try again."; the right password is refused too while locked (the lock is in memory; a restart clears it) |
| AUTH-4 | browser, API | Sign out; reuse the old cookie | pass | API: old cookie 401 after sign-out; browser: Sign out → sign-in page |
| AUTH-5 | browser | Open `/pay?country=DE` signed out, sign in | pass | Browser: /pay?country=DE signed out → sign-in → back on Germany's pay overview |
| AUTH-6 | API, files | Search responses, the server log and the built bundle for the hash, token hashes and key | pass | API: no hash, token, stored token hash or key in 5 responses or the server log; bundle by e2e/secrets.spec.ts |
| LIST-1 | API | Default, 50 and 100 page sizes; total count | pass | API: 25/50/100 rows, same total 8,907; pageSize=30 → 400 |
| LIST-2 | browser | Search "muller", "jose", part of an email, part of a code | pass | Browser: "muller" → 8 incl. Heike Müller; API: "jose" → 41 incl. José Almeida; code and email parts match; each search ~0.1 s |
| LIST-3 | browser | Two countries + one department; default status; add Left | pass | US+IN with Engineering → 2,090, only those; adding Left → 2,339 with leavers counted in stats; Left only → 249 |
| LIST-4 | browser | Each sortable column, both directions | fail → fixed | Every key and direction sorted with ties by code, but Country sorted by code (United Kingdom between Germany and India). Fixed test-first: 9a934d6 → 5915bdb; rechecked: Brazil, Germany, India, …, United Kingdom, United States |
| LIST-5 | browser, API | Salary controls with 0/1/2 countries; API salary sort without one country | fail → fixed | API answered the generic message; now the salary message itself (e03c66e → f94f725). UI: salary boxes disabled with the note unless one country is chosen |
| LIST-6 | browser | Filter, search, sort, page 2; reload; copy link to a new tab; back/forward | pass | Browser: page 2 + Brazil + hire-date sort survive reload; Back returns to the previous view; e2e list.spec.ts covers copied link |
| LIST-7 | browser, API | `pageSize=1000`, `country=XX` | fail → fixed | The page showed "Some fields need fixing." for pageSize=1000; now 'Page size must be 25, 50 or 100, not "1000".' (e03c66e → f94f725); rechecked in Chrome |
| LIST-8 | browser | Read a row | pass | Row: code, name, country, department, role, level, salary with currency, hire date, status badge |
| LIST-9 | browser, SQL | Stats line for a filter; compare a median with SQL | pass | One line per currency above the list; with Left added, leavers counted; Inês (starting) listed, not counted (20 listed, 19 in stats) |
| LIST-10 | browser | 390 px | pass | 390: cards, Filters drawer, no sideways scroll (screenshots + e2e phone.spec) |
| LIST-11 | tests | `npm run measure:list` (Task 19) | pass | Automated tests pass (see Steps) |
| EMP-1 | browser | Open Add employee | pass | Pre-filled E090951 (highest + 1 after the QA script's E090950); E000001 → "E000001 is already used."; custom E090960 saved |
| EMP-2 | browser | Add with every field; currency shown from country | pass | Roles follow department (4 Engineering roles), levels follow role (L5–L7 for Engineering Manager), salary hint shows BRL, "95,000" accepted as 95000, manager optional |
| EMP-3 | browser | Submit empty; then bad values | pass | Empty submit: a message under every field, focus on First name; email "Anthony.Adams@ACME.example" → already used |
| EMP-4 | browser | Open the new person | pass | Inês D'Ávila-Ferreira saved; history shows the hire on 1 Jan 2027 with every field |
| EMP-5 | browser, API | Look for edit controls; PATCH code or hire date | pass | API 400 with the message for code and hire date; page shows both as plain text, no field |
| EMP-6 | browser | Edit name, gender, email | pass | Edit details: last name and email saved in place; header updated |
| EMP-7 | browser | Change before hire date; change with nothing changed; change level only | pass | Nothing changed → "Change at least one of country, department, role, level, manager or salary."; before hire → "can't be dated before the hire date (6 Jun 2012)"; level-only scheduled change kept the other fields |
| EMP-8 | browser | Role not in department; level outside the role | pass | L6 for Sales Development Representative → "Sales Development Representative goes from L1 to L3." |
| EMP-9 | browser | Move country without salary; with salary; move with a later salary scheduled | pass | Move without salary → "Moving to another country needs a salary in the new currency."; with a later USD raise → "A salary change on 1 Jan 2027 is in USD; cancel it before moving this person to Germany."; after cancelling it, saved as USD 51,100 → EUR 48,000 |
| EMP-10 | browser | Manager: self, unknown code, starting person, a report of this person | pass | Browser: self → "Someone can't be their own manager.", E999999 → "No employee with code E999999."; API: starting manager, left manager → "… isn't employed on 15 Nov 2026.", loop → "That would make a reporting loop." |
| EMP-11 | browser | Schedule a change, cancel it; try to cancel a past change | pass | Scheduled change cancelled → "Cancelled on 5 Oct 2026", struck through; no Cancel on past changes; a starting person's hire now offers no Cancel (e0a3001) |
| EMP-12 | SQL, API | `UPDATE`/`DELETE` on job_changes and leave_events; look for edit routes | pass | API: no route (404); SQL: UPDATE/DELETE on job_changes and leave_events refused ("History can't be edited/deleted.") |
| EMP-13 | browser | Two tabs on one person; save in one, then in the other | pass | Saved from another session, then from the page: the 409 message, typed name kept, Reload, save succeeded |
| EMP-14 | browser | Person with manager who left, reports, scheduled and cancelled changes | fail → fixed | Current job, peers line, manager, reports, history. A leaver now shows "Last job" and no comparison with today's peers (b54cc9e → d805b00); rechecked at 390 |
| LEAVE-1 | browser | Leave date before hire date; reason over 500 characters; valid | pass | Before hire → "The leave date can't be before the hire date (6 Jun 2012)."; incomplete date → "Enter the leave date."; 15 Nov 2026 with a reason saved (Leaving). Reason over 500 characters: the box stops at 500 (API limit covered by leave.test.ts) |
| LEAVE-2 | browser | Undo leaving | fail → fixed | Undo clears the leave; both events in history with their dates. The undone leave now reads "Leave cancelled" with its reason struck through (c19f56a → 7921b21); rechecked in Chrome |
| LEAVE-3 | browser, API | Person who has left: page actions; API writes | pass | API: writes to someone who has left → 409 with the message; page shows only Undo leaving and the explanation |
| LEAVE-4 | API | `DELETE /api/employees/<code>` | pass | API: DELETE → 404; person still there |
| LEAVE-5 | browser | Leaving with a later scheduled change; undo | pass | Move on 1 Dec 2026 showed "Won't apply (after leave date)" while leaving 15 Nov; applied again after undo |
| LEAVE-6 | browser | Default list and stats; add Left to status | pass | Default list leaves leavers out (2,090); adding Left adds 249 to list and stats |
| STATS-1 | SQL, browser | One peer group's median by hand vs the page | pass | SQL by hand vs page: IN Software Engineer L3 median 1,486,500, headcount 166, INR only |
| STATS-2 | browser | Starting person in a filter | pass | BR Engineering Manager L5: 20 listed incl. Inês (starting), headcount 19 |
| STATS-3 | browser | Pay overview cells, dashes, cell link | pass | US by default; dashes for empty cells; Engineering L2 cell opened the list for US + Engineering + L2: 197 people, same median USD 117,700 |
| STATS-4 | browser, SQL | A relocated person | pass | E000029 moved IN → US: listed and counted in US only |
| AST-1 | browser | New chat, list order, rename (empty, 81 characters, valid), delete with confirm | pass | New chat; list newest first; title from the first question cut to 60 characters; rename refuses empty and 81 characters ("A chat name needs 1 to 80 characters."), saves a valid name; delete asks first, Cancel keeps it, Delete chat removes it |
| AST-2 | browser | Reload a chat with answers | pass | Reload and reopen: questions, answers, sources, error messages and the Stopped answer as saved |
| AST-3 | browser | Ask | pass | Step "Looking up people: Brazil · Engineering…", then the words, then Based on |
| AST-4 | tests | `assistant.tools.test.ts` (each tool's filters, caps and totals) | pass | Automated tests pass (see Steps) |
| AST-5 | tests | `assistant.tools.test.ts` (bad arguments, unknown tool, read-only transaction, absurd offset) | pass | Automated tests pass (see Steps) |
| AST-6 | tests | `assistant.run.test.ts` (six-round cap) | pass | Automated tests pass (see Steps) |
| AST-7 | tests | `assistant.run.test.ts` (system prompt content, no secrets) | pass | Automated tests pass (see Steps) |
| AST-8 | browser | Click a group link and a person link in Based on | pass | Group link opened BR + Engineering (262, as labelled); person links name and code |
| AST-9 | browser | Ask with `[no tools]` | pass | [no tools] answer labelled "Not based on ACME data" |
| AST-10 | not run | Needs the real model and the OpenRouter key | fail → fixed | Real model (apodex-1.1-mini:free, the chosen one): first run put narration from the lookup round before "The data can't answer this because…"; narration now becomes a step (8a4fbb3 → 5593490). Rerun: "The data can't answer this because the employee records don't track bonus payments at all. …" |
| AST-11 | browser | Ask with `[html]` | pass | [html]: bold, a table and a list render; the img/script tags show as text; no img or script element; title unchanged |
| AST-12 | browser | 2,001 characters; second question while one streams; Stop with `[slow]` | fail → fixed | Box stops at 2,000 characters; a second question waits while one streams; Stop saves the partial answer marked Stopped. Clicking Stop also submitted what was in the box; fixed test-first (e9733d3 → 99de1ae), rechecked in Chrome: Stop, no error, nothing sent |
| AST-13 | tests | `assistant.run.test.ts` (last 20 messages) | pass | Automated tests pass (see Steps) |
| AST-14 | browser | Ask with `[429]`; then other pages | pass | [429] → the free-limit message; question saved; other pages fine |
| AST-15 | browser | Ask with `[500]`; then other pages | pass | [500] → "The assistant isn't available right now. Try again in a minute." (announced once in the status line) |
| AST-16 | browser | Look under the question box | pass | "42 free model requests left today" under the box |
| AST-17 | browser | Watch network requests while asking | pass | Every request from the page went to localhost:4733 (resource timing and the network log) |
| AST-18 | tests | `api/test/setup.ts` guard; e2e server uses the fake | pass | Automated tests pass (see Steps) |
| CSV-1 | browser | Export a filtered list; open the file | pass | Export endpoint (as the link calls it): BOM, the 16 documented columns, 16 rows = the list's total for the same filter (browser download not used: downloads need Nikhil's say-so) |
| CSV-2 | browser | Person named `=SUM(1)`; export | pass | First name =SUM(1) and last name +Kierkegaard export as '=SUM(1) and '+Kierkegaard |
| CSV-3 | browser | Semicolons, BOM, shuffled columns, upper-case headers, currency column | pass | Semicolons, BOM, CRLF, shuffled columns, upper-case headers, a currency column, level "L2", names Søren Kierkegaard-Ørsted: 2 rows ready |
| CSV-4 | browser | File with mistakes | pass | Mistakes file: "1 row ready to import, 9 problems to fix first. Nothing has been saved.", each problem by row and column; the clean row shown as it will be saved |
| CSV-5 | browser | Wrong role for department, bad date, manager in file, manager loop | pass | Wrong role for department, bad date, currency not matching the country, a manager loop (both rows), a manager in the file and one in the database |
| CSV-6 | browser | Code used in the database; email twice in the file | pass | Code in the database and salary separators on the same row both listed; an email twice (any case) on both rows |
| CSV-7 | browser | Import enabled only when clean; import | pass | Import disabled while problems exist; clean file → "Imported 2 employees." with a link to the list |
| CSV-8 | browser | Empty file, missing column, an .xlsx file | pass | Empty → "The file is empty."; no salary column → "The file is missing these columns: salary."; .xlsx → the Excel workbook message |
| SEED-1 | SQL | Count by hire country | pass | SQL: BR 800, DE 1200, GB 1200, IN 3000, JP 800, US 3000 |
| SEED-2 | tests | `seed.test.ts` (checksum of two runs) | pass | seed.test.ts (checksum of two runs) passes in the suite |
| SEED-3 | SQL | Duplicate full names; a few names per country and gender | pass | SQL: no repeated full names; JP sample "Kokona Ishikawa" (given name first) |
| SEED-4 | SQL | Code range; duplicate emails | pass | SQL: E000001–E010000, 10,000 distinct emails |
| SEED-5 | SQL | Latest date anywhere; earliest hire | pass | SQL: last change 2026-09-30, last leave 2026-09-29, hires 2012-01-03 to 2026-09-30 |
| SEED-6 | tests | `seed.test.ts` (medians within ±15% of the research) | pass | seed.test.ts passes in the suite |
| SEED-7 | SQL | Women's vs men's median in a large peer group per country | pass | SQL, largest peer group per country: BR 8.8%, DE 5.3%, GB 8.5%, IN 14.1%, JP 11.7%, US 5.7% lower for women |
| SEED-8 | SQL | People beyond 1.8× / 0.55× of their peer median | pass | SQL: 30 current employees beyond the limits |
| SEED-9 | SQL | Change kinds present; relocations with new currency; leavers | pass | SQL: 48,829 pay, 7,185 level, 4,325 manager changes, 104 relocations (all with a salary in the new currency), 1,093 leavers |
| SEED-10 | tests, SQL | `seed.test.ts`; spot-check one manager's level | pass | seed.test.ts; SQL: 0 reports with a manager at their level or lower on 2026-09-30 |
| A11Y-1 | tests | `e2e/a11y.spec.ts` (axe, both themes, both sizes) | pass | Automated tests pass (see Steps) |
| A11Y-2 | browser | Keyboard only: sign in, find and open, add, job change, leave and undo, import, ask | pass | e2e/keyboard.spec.ts runs all seven flows keyboard-only (green); by hand: Tab order on the list and dialogs works |
| A11Y-3 | browser | Tab through a page; skip link; failed submit | pass | Skip link shows on focus with a visible outline and moves focus to the main content; failed submit focused First name; e2e checks focus rings |
| A11Y-4 | browser | Ask; watch the hidden status line | pass | The only status/live region read "Answer finished." after the answer; nothing announced word by word |
| UI-1 | browser | Device dark/light; toggle; reload | pass | First load followed the device (dark); the toggle chose light and it stayed light after a full reload |
| UI-2 | browser | Money and dates on every screen | pass | "USD 117,700", "JPY 4,003,000", "EUR 48,000"; dates "6 Jun 2012", "Cancelled on 5 Oct 2026" on every screen seen |
| UI-3 | browser | Every screen at 375 and 1440 px | pass | Screenshots at 390 and 1440: every screen scrollWidth = viewport; e2e phone.spec checks seven screens, long values and page buttons. The leaver's email overlap at 390 is fixed (99de1ae) |
| UI-4 | browser | Failed requests on each screen | pass | Bad list address shows the message naming the value (f94f725); server down → "Can't reach the server…" on each screen; field-less refusals carry their message (88598e3) |

## Data changed during the run

All in `acme_e2e`, which the end-to-end server recreates from the seed on every start (the
server was restarted four times during QA, so later rows started from fresh data where noted).

- E090950 "Tama Zone" added by `e2e/qa-api.ts` (TIME-1), hired today in Kiritimati.
- E000029 renamed Rohan Gupta-Rao (email changed), two scheduled changes cancelled, a move to
  Germany scheduled for 1 Dec 2026, a leave on 15 Nov 2026 marked and undone.
- E000195 and E000003 used for refused writes only (nothing saved).
- E090960 Inês D'Ávila-Ferreira added (starting 1 Jan 2027); E091001 and E091002 imported;
  E091001 renamed "=SUM(1) +Kierkegaard" for the export check.
- Chats 1 and 2 created; chat 2 deleted.
- After the restart for re-checks: E000010 marked leaving on 31 Dec 2026, then undone; a
  chat with three questions.
- AUTH-3 locked 127.0.0.1 out of sign-in until the next restart.
- The dev database (`acme`) was read by the model smoke test only (read-only tools).
