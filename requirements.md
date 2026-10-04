# ACME Salary Management: requirements

You're building ACME's salary management app with Nikhil. This file says what to build and how to work. Anything it doesn't specify is yours to research and decide; log each decision with its reason.

## What to build

**Goal:** replace ACME's Excel salary sheets. The HR manager manages pay for 10,000 employees across six countries, and asks a pay assistant questions about how the organisation pays people.

**Persona:** ACME's HR manager. One user, on phone and desktop, who knows the organisation but not SQL.

**Features:**
1. **Find employees:** search, filter, sort and page through 10,000 people, all on the server, with the list state in the URL.
2. **Add and change employees:** validated forms. Job and salary changes are recorded in a history with an effective date. The employee code and hire date can't change after creation. A save from an out-of-date page is refused instead of overwriting.
3. **Record leavers:** mark someone as left, and undo it. Nothing is deleted.
4. **Ask about pay:** HR asks questions in plain words and gets answers from the app's own data.
   - The assistant gets the employees it asks for through tools. Designing the tools is yours.
   - It only reads data, and the model never writes or runs SQL.
   - Every answer shows what it's based on (the people or groups it used), and says plainly when the data can't answer.
   - It uses a free OpenRouter model that supports tool calling. The API key stays on the server. When the free limit is reached, it says so and the rest of the app keeps working.
   - Tests never call the real model.
5. **Excel round trip:** export the filtered list as CSV, and import a CSV all-or-nothing, with a preview and errors listed by row.
6. **Seed:** exactly 10,000 employees, identical every run, with realistic pay per country and role, and a few people paid far from their peers. Every full name is different and fits the person's country and gender.

**Rules:**
- **Countries and currencies:** US USD · IN INR · GB GBP · DE EUR · BR BRL · JP JPY. Amounts in different currencies are never mixed or converted.
- **Pay statistics:** use the median, shown with min, max and headcount.
- **Money:** whole numbers, stored as integers.
- **Accessibility:** WCAG AA, full keyboard use, and error messages in plain words.

## How to build it

**Repository:**
- **Location:** `~/personal_work/salary-management`, git on `master`, local only.
- **Ports:** web 4731, API 4732, end-to-end 4733, Postgres 4734.

**Approvals:** each of these needs Nikhil's approval first:
- a remote or a push: remote `git@github.com:NikhilSagar2000/salary-management.git`, key `~/.ssh/id_personal`, commit email `nikhilsagar592000@gmail.com`;
- a deploy: Neon + Render;
- any account sign-up, including OpenRouter;
- anything that costs money.

**Stack:** TypeScript · Node with Express and Zod · React (Vite) with Mantine · PostgreSQL via `pg` · Vitest · Playwright · Docker Compose.

**Skills:**

| When | Skill |
|---|---|
| Exploring open questions | `superpowers:brainstorming` |
| Planning | `superpowers:writing-plans` |
| Every behaviour | `superpowers:test-driven-development` |
| All code | `ponytail:ponytail` |
| All UI | `design-taste-frontend` |

If a skill is missing, stop and tell Nikhil.

**Phases:**
1. **Set up:** a project `CLAUDE.md` with these rules, `docs/JOURNEY.md`, `tasks/todo.md` and `tasks/lessons.md`.
2. **Brainstorm** the pay assistant and anything else this file leaves open. Pause for Nikhil.
3. **Write the requirements before any code:**
   - `docs/REQUIREMENTS.md`: one page covering the goal, scope and features, and what's deliberately left out with the reason for each;
   - `docs/SPEC.md`: acceptance criteria.
4. **Plan** in `tasks/todo.md`, with every acceptance criterion mapped to a test. Stop for approval.
5. **Build test-first:** the backend, then the UI, then the Playwright flows and CI.
6. **Manual QA:** write test cases for every screen and rule, run all of them, record pass or fail, and fix the failures test-first.
7. **Deploy** after approval, then write the README with setup, tests and a demo-recording script. Nikhil records the video.

**Commits:**
- Each behaviour gets a `test(...)` commit (red), then a `feat(...)` commit (green); add a `refactor(...)` commit only when needed.
- Commit only when the tests pass.
- Keep commits small, so the history shows how the app evolved.

## The journey artifact: `docs/JOURNEY.md`

This is the master record, from the first prompt to the deployed app.

**Its sections:**
1. brief
2. prompt log
3. timeline
4. decision log (context, options, choice, why, who decided)
5. architecture diagram (Mermaid), data model and API
6. trade-offs
7. performance considerations (measured, never guessed)
8. testing strategy
9. AI usage (including where the AI was wrong and how it was caught)
10. deliberately left out
11. deployment
12. retrospective

**Every conversation is logged, both sides:**
- Nikhil's messages, verbatim and numbered (this file is P1), logged before acting on them.
- A short "My reply" under each message, saying what was answered or done, with the commits.
- Every question asked and its answer.
- Every subagent prompt, verbatim, with a summary of what came back.

**How it's kept:**
- Update it in the same commit as the work it describes.
- Append only: a changed decision gets a new entry.
- Copy commit hashes from `git log`.
- Label anything unverified as unverified.

## Stop and ask Nikhil

- After brainstorming.
- After the plan.
- Before anything in the approvals list.
- When a test fails and you can't explain why.

Otherwise keep going.

End every report with three headings: **Blocked on me**, **Changed**, **Found**.
