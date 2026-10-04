// Manual QA, phase 6: the rule checks that are API calls or SQL rather than clicks (docs/QA.md, "How run").
// Run against the end-to-end server: `node e2e/server.ts`, then `node e2e/qa-api.ts`. Prints one line per check.
// It changes data: each run adds one person with a code from E090000 up (the TIME-1 check). AUTH-3 is left out on purpose (it locks this IP out for 15 minutes).
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { E2E_DATABASE_URL, E2E_MODEL_KEY, E2E_PASSWORD, E2E_PORT } from './env.ts';

const BASE = `http://localhost:${E2E_PORT}`;
const results: string[] = [];
const check = (id: string, ok: boolean, detail: string) => results.push(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`);

async function call(path: string, init: { method?: string; body?: unknown; cookie?: string; tz?: string } = {}) {
  const res = await fetch(BASE + path, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.tz ? { 'x-timezone': init.tz } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

async function signIn() {
  const res = await call('/api/session', { method: 'POST', body: { password: E2E_PASSWORD } });
  return { res, cookie: res.headers.get('set-cookie')!.split(';')[0]! };
}
const dateIn = (tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const db = new pg.Pool({ connectionString: E2E_DATABASE_URL });
const sql = async (q: string, params: unknown[] = []) => (await db.query(q, params)).rows;

try {
  // AUTH-1
  const routes: [string, string][] = [
    ['GET', '/api/employees'], ['GET', '/api/employees/E000001'], ['GET', '/api/employees/next-code'], ['GET', '/api/employees.csv'],
    ['GET', '/api/pay-overview?country=US'], ['GET', '/api/chats'], ['GET', '/api/assistant/status'], ['GET', '/api/session'],
    ['POST', '/api/employees'], ['POST', '/api/imports/preview'], ['POST', '/api/chats'], ['DELETE', '/api/session'],
  ];
  const statuses = await Promise.all(routes.map(async ([method, path]) => (await call(path, { method, body: method === 'POST' ? {} : undefined })).status));
  check('AUTH-1', statuses.every((s) => s === 401) && (await call('/api/health')).status === 200,
    `${statuses.filter((s) => s === 401).length}/${routes.length} routes answer 401 signed out; health answers 200`);

  // AUTH-2
  const wrong = await call('/api/session', { method: 'POST', body: { password: 'not it' } });
  const { res: signedIn, cookie } = await signIn();
  const setCookie = signedIn.headers.get('set-cookie') ?? '';
  check('AUTH-2', wrong.status === 401 && wrong.json?.error === "That password isn't right." && signedIn.status === 204 &&
    /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Max-Age=604800/.test(setCookie) && !/Secure/i.test(setCookie),
    `wrong → ${wrong.status} "${wrong.json?.error}"; cookie: ${setCookie.replace(/=[^;]+/, '=…')}`);

  // AUTH-4
  const other = await signIn();
  const out = await call('/api/session', { method: 'DELETE', cookie: other.cookie });
  const after = await call('/api/session', { cookie: other.cookie });
  check('AUTH-4', out.status === 204 && after.status === 401, `sign-out ${out.status}; old cookie then gets ${after.status}`);

  // AUTH-6
  const token = cookie.split('=')[1]!;
  const stored = (await sql('SELECT token_hash FROM sessions LIMIT 50')).map((r) => String(r.token_hash));
  const samples = [await call('/api/employees', { cookie }), await call('/api/employees/E000001', { cookie }), await call('/api/assistant/status', { cookie }),
    await call('/api/chats', { cookie }), await call('/api/session', { cookie })].map((r) => r.text).join('\n');
  const log = readFileSync(process.argv[2] ?? '/dev/null', 'utf8');
  const leaks = [E2E_MODEL_KEY, 'scrypt:', token, ...stored].filter((s) => s && (samples.includes(s) || log.includes(s)));
  check('AUTH-6', leaks.length === 0, `no password hash, session token, stored token hash or model key in 5 responses${process.argv[2] ? ' or the server log' : ''} (bundle: e2e/secrets.spec.ts)`);

  // LIST-1
  const pages = await Promise.all([undefined, 50, 100].map((n) => call(`/api/employees${n ? `?pageSize=${n}` : ''}`, { cookie })));
  const badSize = await call('/api/employees?pageSize=30', { cookie });
  check('LIST-1', pages.map((p) => p.json.rows.length).join() === '25,50,100' && pages[0]!.json.total === pages[1]!.json.total && badSize.status === 400,
    `page sizes 25/50/100 → ${pages.map((p) => p.json.rows.length).join('/')}, total ${pages[0]!.json.total}; pageSize=30 → ${badSize.status}`);

  // LIST-5 (API part)
  const salarySort = await call('/api/employees?sort=salary', { cookie });
  const salaryTwo = await call('/api/employees?country=US,IN&salaryMin=1000', { cookie });
  const salaryOne = await call('/api/employees?country=US&sort=salary&salaryMin=100000', { cookie });
  const msg = 'Choose one country to sort or filter by salary, because salaries are in different currencies.';
  check('LIST-5', salarySort.status === 400 && salarySort.json?.error === msg && salaryTwo.status === 400 && salaryOne.status === 200,
    `no country → ${salarySort.status} "${salarySort.json?.error}"; two countries → ${salaryTwo.status}; one country → ${salaryOne.status}`);

  // LIST-7
  const big = await call('/api/employees?pageSize=1000', { cookie });
  const xx = await call('/api/employees?country=XX', { cookie });
  check('LIST-7', big.status === 400 && /1000/.test(big.text) && xx.status === 400 && /XX/.test(xx.text),
    `pageSize=1000 → ${big.status} ${JSON.stringify(big.json)}; country=XX → ${xx.status} ${JSON.stringify(xx.json)}`);

  // TIME-1: a hire dated "today" in Kiritimati (UTC+14) is active there and starting in Pago Pago (UTC-11)
  const ahead = dateIn('Pacific/Kiritimati');
  const tzCode = `E09${String(Date.now() % 10000).padStart(4, '0')}`;
  const hire = await call('/api/employees', {
    method: 'POST', cookie, tz: 'Pacific/Kiritimati',
    body: { code: tzCode, firstName: 'Tama', lastName: 'Zone', gender: 'female', workEmail: `tama.zone.${tzCode}@acme.example`, hireDate: ahead,
      country: 'US', department: 'Finance', role: 'Accountant', level: 2, salary: 70000, managerCode: null },
  });
  const statusIn = async (tz?: string) => (await call(`/api/employees/${tzCode}`, { cookie, tz })).json?.status;
  const utcStatus = ahead > dateIn('UTC') ? 'starting' : 'active';
  const [there, behind, unknown, missing] = [await statusIn('Pacific/Kiritimati'), await statusIn('Pacific/Pago_Pago'), await statusIn('Mars/Olympus'), await statusIn()];
  check('TIME-1', hire.status === 201 && there === 'active' && behind === 'starting' && unknown === utcStatus && missing === utcStatus,
    `hired ${ahead}: Kiritimati ${there}, Pago Pago ${behind}, unknown zone ${unknown}, no header ${missing} (UTC expects ${utcStatus})`);

  // EMP-5
  const code = await call('/api/employees/E000001', { method: 'PATCH', cookie, body: { version: 1, code: 'E000002' } });
  const hired = await call('/api/employees/E000001', { method: 'PATCH', cookie, body: { version: 1, hireDate: '2020-01-01' } });
  const fixed = "The employee code and hire date can't be changed.";
  check('EMP-5', code.status === 400 && code.json?.error === fixed && hired.status === 400 && hired.json?.error === fixed,
    `code → ${code.status} "${code.json?.error}"; hire date → ${hired.status}`);

  // EMP-12
  const noRoute = await call('/api/employees/E000001/changes/1', { method: 'PATCH', cookie, body: { salary: 1 } });
  const refused = async (q: string) => db.query(q).then(() => 'allowed', (e: Error) => e.message);
  const editChange = await refused('UPDATE job_changes SET salary = 1 WHERE id = 1');
  const deleteChange = await refused('DELETE FROM job_changes WHERE id = 1');
  const deleteLeave = await refused('DELETE FROM leave_events WHERE id = (SELECT min(id) FROM leave_events)');
  const editLeave = await refused("UPDATE leave_events SET reason = 'x' WHERE id = (SELECT min(id) FROM leave_events)");
  check('EMP-12', noRoute.status === 404 && ![editChange, deleteChange, deleteLeave, editLeave].includes('allowed'),
    `PATCH a change → ${noRoute.status}; database: "${editChange}" / "${deleteChange}" / "${deleteLeave}" / "${editLeave}"`);

  // LEAVE-3 (API part): someone who has left
  const [leaver] = await sql("SELECT code, version FROM employees WHERE leave_date <= '2026-09-30' ORDER BY code LIMIT 1");
  const writes = [
    await call(`/api/employees/${leaver.code}`, { method: 'PATCH', cookie, body: { version: leaver.version, firstName: 'X' } }),
    await call(`/api/employees/${leaver.code}/changes`, { method: 'POST', cookie, body: { version: leaver.version, effectiveDate: '2026-10-01', level: 2 } }),
    await call(`/api/employees/${leaver.code}/leave`, { method: 'POST', cookie, body: { version: leaver.version, leaveDate: '2026-10-01' } }),
  ];
  const leftMsg = 'This person has left. Undo leaving first to make changes.';
  check('LEAVE-3', writes.every((w) => w.status === 409 && w.json?.error === leftMsg), `${leaver.code}: details/change/leave → ${writes.map((w) => w.status).join('/')} "${writes[0]!.json?.error}"`);

  // LEAVE-4
  const del = await call('/api/employees/E000001', { method: 'DELETE', cookie });
  const still = await call('/api/employees/E000001', { cookie });
  check('LEAVE-4', del.status === 404 && still.status === 200, `DELETE → ${del.status}; the person is still there (${still.status})`);

  // STATS-1: one peer group's median by hand vs the employee page
  const [peer] = await sql(`SELECT e.code FROM employee_state('${dateIn('UTC')}') s JOIN employees e ON e.id = s.employee_id
    WHERE s.country = 'IN' AND s.role = 'Software Engineer' AND s.level = 3 AND (e.leave_date IS NULL OR e.leave_date > '${dateIn('UTC')}') LIMIT 1`);
  const page = (await call(`/api/employees/${peer.code}`, { cookie })).json.peers;
  const salaries = (await sql(`SELECT s.salary FROM employee_state('${dateIn('UTC')}') s JOIN employees e ON e.id = s.employee_id
    WHERE s.country = 'IN' AND s.role = 'Software Engineer' AND s.level = 3 AND e.hire_date <= '${dateIn('UTC')}'
      AND (e.leave_date IS NULL OR e.leave_date > '${dateIn('UTC')}') ORDER BY s.salary`)).map((r) => Number(r.salary));
  const mid = salaries.length / 2;
  const byHand = salaries.length % 2 ? salaries[Math.floor(mid)]! : Math.round((salaries[mid - 1]! + salaries[mid]!) / 2);
  check('STATS-1', page.median === byHand && page.headcount === salaries.length && page.currency === 'INR' && page.min === salaries[0] && page.max === salaries.at(-1),
    `IN Software Engineer L3: page median ${page.median} vs by hand ${byHand}; headcount ${page.headcount} vs ${salaries.length}; INR only`);

  // STATS-4: a relocated person counts in the current country only
  const [moved] = await sql(`SELECT e.code, s.country AS now_country, h.country AS hire_country
    FROM employees e JOIN employee_state('${dateIn('UTC')}') s ON s.employee_id = e.id
    JOIN job_changes h ON h.employee_id = e.id AND h.id = (SELECT min(id) FROM job_changes WHERE employee_id = e.id)
    WHERE s.country <> h.country AND e.leave_date IS NULL LIMIT 1`);
  const inNow = await call(`/api/employees?q=${moved.code}&country=${moved.now_country}`, { cookie });
  const inOld = await call(`/api/employees?q=${moved.code}&country=${moved.hire_country}`, { cookie });
  check('STATS-4', inNow.json.total === 1 && inOld.json.total === 0,
    `${moved.code} moved ${moved.hire_country} → ${moved.now_country}: listed and counted in ${moved.now_country} (${inNow.json.total}), not ${moved.hire_country} (${inOld.json.total})`);

  // SEED-1
  const byCountry = await sql(`SELECT h.country, count(*)::int AS n FROM job_changes h
    WHERE h.id IN (SELECT min(id) FROM job_changes GROUP BY employee_id) AND h.employee_id IN (SELECT id FROM employees WHERE code <= 'E010000')
    GROUP BY h.country ORDER BY h.country`);
  const counts = Object.fromEntries(byCountry.map((r) => [r.country, r.n]));
  check('SEED-1', JSON.stringify(counts) === JSON.stringify({ BR: 800, DE: 1200, GB: 1200, IN: 3000, JP: 800, US: 3000 }), `by hire country ${JSON.stringify(counts)}`);

  // SEED-3
  const [dupNames] = await sql("SELECT count(*)::int AS n FROM (SELECT first_name, last_name FROM employees WHERE code <= 'E010000' GROUP BY 1, 2 HAVING count(*) > 1) d");
  const jp = await sql(`SELECT e.first_name, e.last_name, e.gender FROM employees e JOIN job_changes h ON h.employee_id = e.id
    AND h.id = (SELECT min(id) FROM job_changes WHERE employee_id = e.id) WHERE h.country = 'JP' ORDER BY e.code LIMIT 3`);
  check('SEED-3', dupNames.n === 0, `${dupNames.n} repeated full names; Japanese sample: ${jp.map((r) => `${r.first_name} ${r.last_name} (${r.gender})`).join(', ')}`);

  // SEED-4
  const [codes] = await sql("SELECT min(code) AS lo, max(code) AS hi, count(*)::int AS n, count(DISTINCT lower(work_email))::int AS emails FROM employees WHERE code <= 'E010000'");
  check('SEED-4', codes.lo === 'E000001' && codes.hi === 'E010000' && codes.n === 10000 && codes.emails === 10000, `${codes.lo}–${codes.hi}, ${codes.n} people, ${codes.emails} distinct emails`);

  // SEED-5
  const [dates] = await sql(`SELECT (SELECT max(effective_date) FROM job_changes j JOIN employees e ON e.id = j.employee_id WHERE e.code <= 'E010000')::text AS last_change,
    (SELECT max(leave_date) FROM employees WHERE code <= 'E010000')::text AS last_leave, (SELECT min(hire_date) FROM employees)::text AS first_hire,
    (SELECT max(hire_date) FROM employees WHERE code <= 'E010000')::text AS last_hire`);
  check('SEED-5', dates.last_change <= '2026-09-30' && dates.last_leave <= '2026-09-30' && dates.first_hire >= '2012-01-01' && dates.last_hire <= '2026-09-30',
    `last change ${dates.last_change}, last leave ${dates.last_leave}, hires ${dates.first_hire} to ${dates.last_hire}`);

  // SEED-7: women's vs men's median in the largest peer group per country
  const gaps = await sql(`WITH s AS (SELECT st.country, st.role, st.level, e.gender, st.salary FROM employee_state('2026-09-30') st JOIN employees e ON e.id = st.employee_id
      WHERE e.leave_date IS NULL OR e.leave_date > '2026-09-30'),
    g AS (SELECT country, role, level FROM s GROUP BY 1, 2, 3 ORDER BY count(*) DESC),
    top AS (SELECT DISTINCT ON (country) country, role, level FROM (SELECT country, role, level, count(*) n FROM s GROUP BY 1, 2, 3) x ORDER BY country, n DESC)
    SELECT t.country, t.role, t.level,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY s.salary) FILTER (WHERE s.gender = 'female') AS women,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY s.salary) FILTER (WHERE s.gender = 'male') AS men
    FROM top t JOIN s USING (country, role, level) GROUP BY 1, 2, 3 ORDER BY 1`);
  const gapText = gaps.map((g) => `${g.country} ${g.role} L${g.level} ${(100 * (1 - g.women / g.men)).toFixed(1)}%`).join('; ');
  check('SEED-7', gaps.every((g) => g.women < g.men), `women below men in each country's largest peer group: ${gapText}`);

  // SEED-8
  const [outliers] = await sql(`WITH s AS (SELECT st.country, st.role, st.level, st.salary FROM employee_state('2026-09-30') st JOIN employees e ON e.id = st.employee_id
      WHERE e.leave_date IS NULL OR e.leave_date > '2026-09-30'),
    m AS (SELECT country, role, level, percentile_cont(0.5) WITHIN GROUP (ORDER BY salary) AS median, count(*) AS n FROM s GROUP BY 1, 2, 3)
    SELECT count(*)::int AS n FROM s JOIN m USING (country, role, level) WHERE m.n >= 20 AND (s.salary > 1.8 * m.median OR s.salary < 0.55 * m.median)`);
  check('SEED-8', outliers.n >= 20 && outliers.n <= 40, `${outliers.n} current employees beyond 1.8× / 0.55× of their peer median (groups of 20+)`);

  // SEED-9
  const kinds = await sql(`SELECT count(*) FILTER (WHERE c.salary IS NOT NULL AND c.id <> h.min_id)::int AS pay_changes,
      count(*) FILTER (WHERE c.level IS NOT NULL AND c.id <> h.min_id)::int AS level_changes,
      count(*) FILTER (WHERE c.manager_set AND c.id <> h.min_id)::int AS manager_changes,
      count(*) FILTER (WHERE c.country IS NOT NULL AND c.id <> h.min_id)::int AS relocations
    FROM job_changes c JOIN (SELECT employee_id, min(id) AS min_id FROM job_changes GROUP BY 1) h USING (employee_id)`);
  const [badMoves] = await sql(`SELECT count(*)::int AS n FROM job_changes c WHERE c.country IS NOT NULL AND (c.salary IS NULL OR c.currency <> CASE c.country
    WHEN 'US' THEN 'USD' WHEN 'IN' THEN 'INR' WHEN 'GB' THEN 'GBP' WHEN 'DE' THEN 'EUR' WHEN 'BR' THEN 'BRL' WHEN 'JP' THEN 'JPY' END)`);
  const [leavers] = await sql("SELECT count(*)::int AS n FROM employees WHERE leave_date IS NOT NULL AND code <= 'E010000'");
  const k = kinds[0];
  check('SEED-9', k.pay_changes > 0 && k.level_changes > 0 && k.manager_changes > 0 && k.relocations > 0 && badMoves.n === 0 && leavers.n > 0,
    `${k.pay_changes} pay changes, ${k.level_changes} level changes, ${k.manager_changes} manager changes, ${k.relocations} relocations (${badMoves.n} without a salary in the new currency), ${leavers.n} leavers`);

  // SEED-10 (spot check): a manager has a higher level than their report
  const [pair] = await sql(`SELECT r.level AS report_level, m.level AS manager_level FROM employee_state('2026-09-30') r
    JOIN employee_state('2026-09-30') m ON m.employee_id = r.manager_id ORDER BY r.employee_id LIMIT 1`);
  const [lower] = await sql(`SELECT count(*)::int AS n FROM employee_state('2026-09-30') r JOIN employee_state('2026-09-30') m ON m.employee_id = r.manager_id
    JOIN employees re ON re.id = r.employee_id WHERE m.level <= r.level AND re.code <= 'E010000'`);
  check('SEED-10', pair.manager_level > pair.report_level && lower.n === 0, `on 2026-09-30, ${lower.n} reports have a manager at their level or lower`);
} finally {
  await db.end();
}
console.log(results.join('\n'));
