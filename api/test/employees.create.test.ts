import { expect, test } from 'vitest';
import { signIn, testApp } from './helpers.ts';

export const newEmployee = {
  code: 'E000123', firstName: 'Ana', lastName: 'Silva', gender: 'female', workEmail: 'ana.silva@acme.example',
  hireDate: '2024-02-29', country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 3, salary: 133000,
};

test('suggests the next free code', async () => {
  const { app } = await testApp();
  const agent = await signIn(app);
  expect((await agent.get('/api/employees/next-code')).body).toEqual({ code: 'E000001' });
  expect((await agent.post('/api/employees').send(newEmployee)).status).toBe(201);
  expect((await agent.get('/api/employees/next-code')).body).toEqual({ code: 'E000124' });
});

test('rejects a malformed or used code', async () => {
  const { app } = await testApp();
  const agent = await signIn(app);
  const bad = await agent.post('/api/employees').send({ ...newEmployee, code: 'E12' });
  expect(bad.status).toBe(400);
  expect(bad.body).toEqual({ error: 'Some fields need fixing.', fields: { code: 'Employee code must be E followed by 6 digits, like E000123.' } });
  expect((await agent.post('/api/employees').send(newEmployee)).status).toBe(201);
  const used = await agent.post('/api/employees').send({ ...newEmployee, workEmail: 'other@acme.example' });
  expect(used.status).toBe(400);
  expect(used.body).toEqual({ error: 'Some fields need fixing.', fields: { code: 'E000123 is already used.' } });
});

test('creates an employee with currency from the country', async () => {
  const { app, db } = await testApp();
  const agent = await signIn(app);
  const res = await agent.post('/api/employees').send(newEmployee);
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ code: 'E000123', version: 1 });
  const { rows } = await db.query(
    "SELECT c.country, c.salary, c.currency FROM job_changes c JOIN employees e ON e.id = c.employee_id WHERE e.code = 'E000123'",
  );
  expect(rows).toEqual([{ country: 'BR', salary: 133000, currency: 'BRL' }]);
});

test('saves the hire change dated on the hire date', async () => {
  const { app, db } = await testApp();
  const agent = await signIn(app);
  await agent.post('/api/employees').send({ ...newEmployee, country: 'JP', salary: '6070000' });
  const { rows } = await db.query(
    `SELECT c.effective_date, c.country, c.department, c.role, c.level, c.manager_set, c.manager_id, c.salary, c.currency, c.cancelled_at
     FROM job_changes c JOIN employees e ON e.id = c.employee_id WHERE e.code = 'E000123'`,
  );
  expect(rows).toEqual([{
    effective_date: '2024-02-29', country: 'JP', department: 'Engineering', role: 'Software Engineer', level: 3,
    manager_set: true, manager_id: null, salary: 6070000, currency: 'JPY', cancelled_at: null,
  }]);
});

test.fails('rejects an email already used, ignoring case', async () => {
  const { app } = await testApp();
  const agent = await signIn(app);
  expect((await agent.post('/api/employees').send(newEmployee)).status).toBe(201);
  const res = await agent.post('/api/employees').send({ ...newEmployee, code: 'E000124', workEmail: 'Ana.Silva@ACME.example' });
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Some fields need fixing.', fields: { workEmail: 'That work email is already used.' } });
});
