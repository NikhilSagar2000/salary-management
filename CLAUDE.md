# ACME Salary Management

Web app replacing ACME's Excel salary sheets for one HR manager (phone + desktop): 10,000
employees in six countries, plus a read-only pay assistant. Built with Nikhil.

- Full brief: `requirements.md` (P1). Requirements: `docs/REQUIREMENTS.md`. Acceptance
  criteria: `docs/SPEC.md`. Plan and progress: `tasks/todo.md`. Lessons: `tasks/lessons.md`
  (read at session start). Master record: `docs/JOURNEY.md`.

## Working with Nikhil

- **Ask, never assume.** When anything is unclear, ask Nikhil. Offer a recommended answer,
  and leave room for him to type his own.
- **Stop and ask:** after brainstorming; after the plan; before anything in Approvals; when a
  test fails and you can't explain why. Otherwise keep going.
- **Approvals first** for: adding a remote or pushing (`git@github.com:NikhilSagar2000/salary-management.git`,
  key `~/.ssh/id_personal`); any deploy (Neon + Render); any account sign-up (incl. OpenRouter);
  anything that costs money.
- End every report with three headings: **Blocked on me**, **Changed**, **Found**.
- After any correction from Nikhil, add the pattern to `tasks/lessons.md`.

## JOURNEY.md (append only)

- Log each Nikhil message verbatim and numbered (P1 = `requirements.md`) **before** acting
  on it, with a short "My reply" under it naming what was answered or done and the commits.
- Log every question asked and its answer, and every subagent prompt verbatim with a summary
  of what came back.
- Update it in the same commit as the work it describes. A changed decision gets a new entry.
- Copy commit hashes from `git log`. Label anything unverified as unverified. Performance
  numbers are measured, never guessed.

## Building

- **Skills:** `superpowers:brainstorming` for open questions · `superpowers:writing-plans`
  for planning · `superpowers:test-driven-development` for every behaviour ·
  `ponytail:ponytail` for all code · `design-taste-frontend` for all UI ·
  `llm-security` for the assistant. If a skill is missing, stop and tell Nikhil.
- **Commits:** per behaviour, a `test(...)` commit (red), then `feat(...)` (green);
  `refactor(...)` only when needed. Every commit has a passing suite: the red commit adds the
  new test with an expected-to-fail marker (`test.fails` in Vitest, `test.fail()` in
  Playwright); the green commit removes the marker and adds the code. Small commits. Git on `master`, local only. Author is the repo-local
  identity (Nikhil Sagar, personal email).
- **Stack:** TypeScript · Node + Express + Zod · React (Vite) + Mantine · PostgreSQL via `pg` ·
  Vitest · Playwright · Docker Compose. npm workspaces: `api/`, `web/`, `shared/`.
- **Ports:** web 4731 · API 4732 · end-to-end 4733 · Postgres 4734.

## Domain rules

- Countries and currencies: US USD · IN INR · GB GBP · DE EUR · BR BRL · JP JPY. Never mix
  or convert amounts across currencies; every statistic is split by currency.
- Money is a whole number stored as an integer. Salary = annual base salary.
- Pay statistics: median, shown with min, max and headcount.
- Accessibility: WCAG AA, full keyboard use, error messages in plain words.
- Employee code (`E000001`) and hire date never change after creation. Job, pay, manager and
  country changes are new effective-dated history rows; history rows are never edited.
- Nothing is deleted except chats. Leavers are marked and can be undone.
- "Today" is the date in HR's browser timezone (`X-Timezone` header, UTC fallback), from the
  app's injectable clock; tests fix it. The seed's dates sit on or before 2026-09-30.
- Pay assistant: reads data only through tools, the model never writes or runs SQL, every
  answer shows its sources, the API key stays on the server, and tests never call the real model.
