import { expect, test } from 'vitest';
import { testApp } from './helpers.ts';

async function insertEmployee(db: import('pg').Pool) {
  const { rows } = await db.query(
    `INSERT INTO employees (code, first_name, last_name, gender, work_email, hire_date)
     VALUES ('E000001', 'Ana', 'Silva', 'female', 'ana.silva@acme.example', '2020-01-15') RETURNING id`,
  );
  return rows[0].id as number;
}

test('database refuses changing code or hire date', async () => {
  const { db } = await testApp();
  const id = await insertEmployee(db);
  const message = "The employee code and hire date can't be changed.";
  await expect(db.query("UPDATE employees SET code = 'E000002' WHERE id = $1", [id])).rejects.toThrow(message);
  await expect(db.query("UPDATE employees SET hire_date = '2021-01-01' WHERE id = $1", [id])).rejects.toThrow(message);
  await db.query("UPDATE employees SET first_name = 'Anna' WHERE id = $1", [id]);
  expect((await db.query('SELECT first_name FROM employees WHERE id = $1', [id])).rows[0].first_name).toBe('Anna');
});

test.fails('database refuses UPDATE of change fields and any DELETE of history', async () => {
  const { db } = await testApp();
  const id = await insertEmployee(db);
  const { rows } = await db.query(
    `INSERT INTO job_changes (employee_id, effective_date, country, department, role, level, manager_set, salary, currency)
     VALUES ($1, '2020-01-15', 'BR', 'Engineering', 'Software Engineer', 3, true, 133000, 'BRL') RETURNING id`,
    [id],
  );
  const changeId = rows[0].id;
  await db.query("INSERT INTO leave_events (employee_id, kind, leave_date) VALUES ($1, 'left', '2026-01-31')", [id]);

  await expect(db.query('UPDATE job_changes SET salary = 1 WHERE id = $1', [changeId])).rejects.toThrow("History can't be edited.");
  await expect(db.query('DELETE FROM job_changes WHERE id = $1', [changeId])).rejects.toThrow("History can't be deleted.");
  await expect(db.query('DELETE FROM employees WHERE id = $1', [id])).rejects.toThrow("Employees can't be deleted.");
  await expect(db.query("UPDATE leave_events SET reason = 'x'")).rejects.toThrow("History can't be edited.");
  await expect(db.query('DELETE FROM leave_events')).rejects.toThrow("History can't be deleted.");

  await db.query('UPDATE job_changes SET cancelled_at = now() WHERE id = $1', [changeId]);
  await expect(db.query('UPDATE job_changes SET cancelled_at = now() WHERE id = $1', [changeId])).rejects.toThrow("History can't be edited.");
});

test.fails('a change stores a salary only with its currency, and a country only with a salary in that currency', async () => {
  const { db } = await testApp();
  const id = await insertEmployee(db);
  const insert = (cols: string, vals: string) =>
    db.query(`INSERT INTO job_changes (employee_id, effective_date, ${cols}) VALUES ($1, '2021-01-01', ${vals})`, [id]);
  await expect(insert('country', "'DE'")).rejects.toThrow(/check constraint/);
  await expect(insert('country, salary, currency', "'DE', 80000, 'USD'")).rejects.toThrow(/check constraint/);
  await expect(insert('salary', '80000')).rejects.toThrow(/check constraint/);
  await expect(insert('note', "'nothing changes'")).rejects.toThrow(/check constraint/);
  await insert('country, salary, currency', "'DE', 80000, 'EUR'");
  await insert('salary, currency', "90000, 'EUR'");
  await insert('manager_set', 'true');
});
