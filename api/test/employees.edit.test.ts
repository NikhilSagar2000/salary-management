import { expect, test } from 'vitest';
import { newEmployee, signIn, testApp } from './helpers.ts';

async function withEmployee() {
  const { app, db } = await testApp();
  const agent = await signIn(app);
  await agent.post('/api/employees').send(newEmployee);
  return { agent, db };
}

test('edits first name, last name, gender and email in place', async () => {
  const { agent, db } = await withEmployee();
  await agent.post('/api/employees').send({ ...newEmployee, code: 'E000200', workEmail: 'taken@acme.example' });
  const changes = { firstName: 'Anna', lastName: 'Souza', gender: 'non_binary', workEmail: 'anna.souza@acme.example' };
  const res = await agent.patch('/api/employees/E000123').send({ version: 1, ...changes });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ code: 'E000123', version: 2 });
  const { rows } = await db.query(
    "SELECT first_name, last_name, gender, work_email, (SELECT count(*) FROM job_changes WHERE employee_id = e.id) AS changes FROM employees e WHERE code = 'E000123'",
  );
  expect(rows[0]).toEqual({ first_name: 'Anna', last_name: 'Souza', gender: 'non_binary', work_email: 'anna.souza@acme.example', changes: 1 });
  const taken = await agent.patch('/api/employees/E000123').send({ version: 2, workEmail: 'TAKEN@acme.example' });
  expect(taken.status).toBe(400);
  expect(taken.body.fields).toEqual({ workEmail: 'That work email is already used.' });
});

test('refuses to change code or hire date', async () => {
  const { agent, db } = await withEmployee();
  for (const body of [{ code: 'E000999' }, { hireDate: '2020-01-01' }, { code: 'E000123', firstName: 'Anna' }]) {
    const res = await agent.patch('/api/employees/E000123').send({ version: 1, ...body });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "The employee code and hire date can't be changed." });
  }
  const { rows } = await db.query('SELECT code, hire_date, first_name, version FROM employees');
  expect(rows).toEqual([{ code: 'E000123', hire_date: '2024-02-29', first_name: 'Ana', version: 1 }]);
});
