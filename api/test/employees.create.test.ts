import { expect, test } from 'vitest';
import { signIn, testApp } from './helpers.ts';

export const newEmployee = {
  code: 'E000123', firstName: 'Ana', lastName: 'Silva', gender: 'female', workEmail: 'ana.silva@acme.example',
  hireDate: '2024-02-29', country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 3, salary: 133000,
};

test.fails('suggests the next free code', async () => {
  const { app } = await testApp();
  const agent = await signIn(app);
  expect((await agent.get('/api/employees/next-code')).body).toEqual({ code: 'E000001' });
  expect((await agent.post('/api/employees').send(newEmployee)).status).toBe(201);
  expect((await agent.get('/api/employees/next-code')).body).toEqual({ code: 'E000124' });
});
