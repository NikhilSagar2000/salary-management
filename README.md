# ACME Pay: salary management

A web app that replaces ACME's Excel salary sheets for one HR manager, on a phone or a desktop:
10,000 employees in six countries (six currencies, never mixed or converted), their pay
history, pay statistics, an Excel round trip, and a read-only pay assistant that answers
questions from the data and shows what each answer is based on.

**Live demo:** https://acme-salary-aqw1.onrender.com (sign-in password: ask Nikhil). It runs on free
plans: after a quiet spell the first visit takes about a minute to wake up.

## What it does

- **Employees:** search (accent-blind), filter, sort and page 10,000 people on the server; the
  address holds the view, so reload, back and shared links work. Cards and a filter drawer on
  a phone.
- **An employee's page:** current job and pay, where they sit against peers, manager and
  reports, and a dated history: raises, promotions, moves, manager changes, scheduled changes
  (which can be cancelled), leaving and undoing it. History is never edited or deleted.
- **Changes:** add people; edit details; change job, pay, country or manager from a date (past,
  today or future); mark leavers and undo. Every save checks it isn't overwriting someone
  else's newer change.
- **Pay overview:** one country at a time, department by level, each cell giving the median, min,
  max and headcount and linking to the list.
- **Excel:** export any filtered list as CSV (UTF-8, safe from formula injection); import new
  people from CSV with a full preview, all or nothing.
- **Pay assistant:** saved chats; answers stream in with the lookups they made; every answer
  lists the groups and people it is based on. The model only reads data through four typed,
  read-only tools; it never writes or runs SQL, and the API key stays on the server.
- **Accessible:** WCAG 2.1 AA checked with axe in light and dark at phone and desktop sizes;
  every flow works with the keyboard alone.

## Run it locally

You need Node 24 and Docker.

```bash
npm ci
cp .env.example .env
npm run hash-password          # type a password, press Enter, paste the output into APP_PASSWORD_HASH
npm run db:up                  # Postgres 17 in Docker on port 4734 (databases acme and acme_test)
npm run seed                   # 10,000 people with realistic history (the API applies migrations itself)
npm run dev:api                # API on http://localhost:4732
npm run dev:web                # in a second terminal: the app on http://localhost:4731
```

The assistant needs an [OpenRouter](https://openrouter.ai) key in `.env` (`OPENROUTER_API_KEY`),
a model in `OPENROUTER_MODEL` and optional backups in `OPENROUTER_FALLBACK_MODELS`. The live site
asks free models first and falls back to `qwen/qwen3.7-flash`, a paid model at about $0.0004 a
question, when they're busy or limited; that needs OpenRouter credit, and buying $10 also raises
the free limit from 50 to 1,000 requests a day. Without a key, everything else works and the
assistant says it isn't available. The free models log prompts; the seed data is made up, but
before using real salaries switch to a paid model that doesn't keep data.

## Tests

| Command | What it runs |
|---|---|
| `npm test` | Type-check, then Vitest: shared rules, the API against Postgres (`acme_test`), the web app in jsdom |
| `npm run e2e` | Playwright on port 4733: builds the app, recreates `acme_e2e` from the seed, uses a local fake OpenRouter |
| `npm run smoke:model` | The real free models with your key (about five free requests per model; not part of `npm test`) |
| `npm run measure:list` | The list's 95th-percentile response time on the seeded database (limit 300 ms) |

No automated test calls the real model: unit tests use a scripted model, end-to-end tests a fake
OpenRouter, and the test set-up refuses OpenRouter's real address. CI (`.github/workflows/ci.yml`)
runs `npm test` and the Playwright suite on every push.

## Deploy (Neon + Render)

1. Create a Neon project (Postgres 17, a region near you) and copy its direct connection string
   (not the pooled one), ending in `?sslmode=verify-full`.
2. Load the seed into it from your machine:
   `DATABASE_URL='<neon connection string>' npm run seed`
3. In Render choose **New › Blueprint**, pick this repository, and enter the three secrets
   `render.yaml` asks for: `DATABASE_URL` (Neon), `APP_PASSWORD_HASH` (from
   `npm run hash-password`) and `OPENROUTER_API_KEY`.
4. Render builds the web app, starts the API (which applies pending migrations and serves the
   app), and checks `/api/health`. Free services sleep when idle; the first visit after a pause
   takes about a minute.

## Project records

- `requirements.md`: the brief. `docs/REQUIREMENTS.md`: goal, scope, what's left out and why.
- `docs/SPEC.md`: numbered acceptance criteria. `tasks/todo.md`: the plan, each criterion's tests,
  and the build ledger.
- `docs/QA.md`: manual QA, every screen and rule with its result.
- `docs/JOURNEY.md`: every prompt, question, decision and commit, in order.

## Demo recording script (about 6 minutes)

Record at desktop width first, then switch the browser to a phone size for one minute.

1. **Sign in** (0:00). Open a deep link such as `/pay?country=DE` while signed out; sign in and
   land back on it.
2. **Find people** (0:30). Employees: type "muller" (finds Müller); pick two countries and a
   department; sort by Hired; open page 2. Reload and use Back to show the view is kept. Pick
   one country to enable the salary range.
3. **One person** (1:30). Open someone: current pay, "x% above the median of n peers", manager,
   history with from and to values.
4. **Change pay** (2:00). Change job or pay with a date next month: a raise and a promotion.
   It shows as Scheduled; cancel it ("Cancelled on …"). Try moving them to Germany without a
   salary to show the plain message, then with one.
5. **Leaving** (2:45). Mark as leaving on a future date with a reason; point at changes that
   won't apply; undo.
6. **Add someone** (3:15). Add employee: the suggested code, roles following the department,
   levels following the role, messages under each field on an empty submit.
7. **Pay overview** (3:45). Switch countries; open a cell to land on the matching list.
8. **Excel** (4:15). Export the current filter; import a file with a mistake to show the
   row-by-row problems, then a clean file.
9. **Assistant** (4:45). New chat: "What is the median salary of L4 engineers in Germany and
   in Brazil?" Watch the lookups and the words stream in; open a "Based on" link. Ask something
   the data can't answer ("What bonus did engineers get?"). Rename the chat.
10. **Phone and theme** (5:30). Phone width: cards, the Filters drawer, the employee page.
    Toggle dark mode.
