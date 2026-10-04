# ACME Salary Management: requirements

## Goal

Replace ACME's Excel salary sheets with one web app where ACME's HR manager keeps pay for
10,000 employees in six countries correct and current, and gets plain-language answers about
how the organisation pays people. Success: everything HR did in the sheets can be done in
the app, on a phone or a desktop, without SQL.

**User:** ACME's HR manager. One person, signed in with a single password. Knows the
organisation, not SQL.

**Company:** a tech company. Departments: Engineering, Product, Design, Sales, Marketing,
Customer Support, Finance, HR, Operations. Levels L1 (entry) to L7 (principal/director).
Countries and currencies: US USD · IN INR · GB GBP · DE EUR · BR BRL · JP JPY.

## Features in scope

1. **Sign in.** One password (stored only as a hash); session lasts 7 days; sign out.
2. **Find employees.** Search by name, email or code; filter by country, department, role,
   level, gender and status (starting, active, leaving, left); sort; page. All done by the
   server; the list's state lives in the URL. Salary sort and salary-range filter only when
   exactly one country is selected. Phone shows cards instead of a table.
3. **Add and change employees.** Validated forms. Code (`E000001`, next free code
   suggested) and hire date can't change after creation. Personal details (name, gender,
   email) are edited in place. Job, pay, manager and country changes are new history entries
   with an effective date (past or future, never before hire); history entries are never
   edited. A relocation must set a salary in the new currency. A save from an out-of-date
   page is refused with a plain message.
4. **Record leavers.** Mark someone as leaving or left (date, optional reason) and undo it.
   Leavers are hidden by default, left out of pay statistics, and read-only
   apart from undo. Nothing about an employee is ever deleted.
5. **Pay statistics.** Median with min, max and headcount, always per currency: on each
   employee's page (their pay against peers: same country, role and level) and on a
   pay overview page (department × level per country, each cell opening the matching list).
6. **Ask about pay.** ChatGPT-style chats, saved, renamed and deleted. Answers stream in
   word by word. The model reads data only through read-only tools (search people, read one
   person's history, search changes, and exact server-side statistics); it never writes or
   runs SQL. Each answer lists what it was based on (people and groups, with links) and says
   plainly when the data can't answer. Runs on a free OpenRouter model with the key on the
   server; when the free limit is reached the chat says so and the rest of the app works.
7. **Excel round trip.** Export the filtered list as CSV (opens cleanly in Excel). Import a
   CSV of new employees: preview first, every problem listed by row, and all rows saved or
   none. A code or email that already exists, or repeats within the file, rejects the file.
8. **Seed.** Exactly 10,000 employees, identical every run: US 3000, IN 3000, GB 1200,
   DE 1200, BR 800, JP 800. Realistic pay per country, role and level from cited sources,
   a small gender pay gap that varies by country, realistic history since 2012, about 30
   people paid far from their peers, every full name different and fitting the person's
   country and gender (female, male, non-binary; Japanese names in romaji, given name first).

## Rules

Currencies are never mixed or converted. Money is whole numbers stored as integers (annual
base salary). Statistics use the median with min, max and headcount. WCAG AA, full keyboard
use, error messages in plain words. Light and dark themes.

## Deliberately left out

| Left out | Why |
|---|---|
| More users, roles and permissions | One HR manager is the only user. |
| Currency conversion | The rules forbid mixing or converting currencies. |
| Bonus, equity, allowances | Annual base salary is what HR compares; extra pay types multiply forms, history and stats. |
| Payroll, tax, payslips | A salary record is not a payroll system; tax rules differ in all six countries. |
| Updating employees by CSV import | Nikhil chose create-only import; updates go through the forms, which record history with an effective date. |
| Deleting employees | "Nothing is deleted"; leavers are marked instead. |
| Editing history entries | History is an audit trail; a mistake is corrected by a new entry. |
| UI translations | One English-speaking user. |
| Org chart view | Managers are recorded and shown on each employee; a chart view wasn't asked for. |
| Self-hosted or paid AI model | The brief asks for a free OpenRouter model; data is fictional (paid, no-logging model needed before real data). |
