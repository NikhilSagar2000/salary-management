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
