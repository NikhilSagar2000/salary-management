import { MSG } from '@acme/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { renderApp } from '../test/render.tsx';

const start = (extra: Parameters<typeof fakeApi>[0] = {}) => {
  const calls = fakeApi({
    'GET /api/session': () => ({ status: 200, body: { signedIn: true } }),
    'GET /api/employees/next-code': () => ({ status: 200, body: { code: 'E010001' } }),
    ...extra,
  });
  renderApp('/employees/new');
  return calls;
};
const combobox = (name: string) => screen.getByRole('combobox', { name });
const pick = async (name: string, option: string) => {
  await userEvent.click(combobox(name));
  await userEvent.click(await screen.findByRole('option', { name: option }));
};
const options = async (name: string) => {
  await userEvent.click(combobox(name));
  const list = (await screen.findAllByRole('option')).map((o) => o.textContent);
  await userEvent.keyboard('{Escape}');
  return list;
};
const suggestedCode = async () => {
  const code = await screen.findByLabelText('Employee code');
  await waitFor(() => expect(code).toHaveValue('E010001'));
  return code;
};
const fillValid = async () => {
  await userEvent.type(screen.getByLabelText('First name'), 'Lucas');
  await userEvent.type(screen.getByLabelText('Last name'), 'Pereira');
  await pick('Gender', 'Male');
  await userEvent.type(screen.getByLabelText('Work email'), 'lucas.pereira@acme.example');
  fireEvent.change(screen.getByLabelText('Hire date'), { target: { value: '2026-10-05' } });
  await pick('Country', 'Brazil');
  await pick('Department', 'Engineering');
  await pick('Role', 'Software Engineer');
  await pick('Level', 'L2');
  await userEvent.type(screen.getByLabelText('Salary'), '80000');
};

test('pre-fills the suggested code, editable', async () => {
  const calls = start({ 'POST /api/employees': () => ({ status: 201, body: { code: 'E010050', version: 1 } }) });
  expect(await screen.findByRole('heading', { name: 'Add employee' })).toBeInTheDocument();
  const code = await suggestedCode();
  await userEvent.clear(code);
  await userEvent.type(code, 'E010050');
  await fillValid();
  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/employees/E010050'));
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
    code: 'E010050', firstName: 'Lucas', lastName: 'Pereira', gender: 'male', workEmail: 'lucas.pereira@acme.example',
    hireDate: '2026-10-05', country: 'BR', department: 'Engineering', role: 'Software Engineer', level: 2, salary: 80000,
    managerCode: null,
  });
});

test('role choices follow the department, level choices follow the role', async () => {
  start();
  await suggestedCode();
  await pick('Department', 'Sales');
  expect(await options('Role')).toEqual(['Sales Development Representative', 'Account Executive', 'Sales Manager']);
  await pick('Role', 'Sales Manager');
  expect(await options('Level')).toEqual(['L5', 'L6', 'L7']);
  await pick('Level', 'L6');

  await pick('Role', 'Sales Development Representative'); // L6 doesn't fit this role, so the level clears
  expect(combobox('Level')).toHaveValue('');
  expect(await options('Level')).toEqual(['L1', 'L2', 'L3']);
  await pick('Department', 'Finance'); // the role isn't in Finance, so it clears
  expect(combobox('Role')).toHaveValue('');
  expect(await options('Role')).toEqual(['Accountant', 'Financial Analyst']);
});

test("shows each field's message next to it", async () => {
  const calls = start({
    'POST /api/employees': () => ({ status: 400, body: { error: MSG.fixFields, fields: { code: MSG.codeUsed('E010001') } } }),
  });
  const code = await suggestedCode();
  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));

  const expected: [HTMLElement, string][] = [
    [screen.getByLabelText('First name'), MSG.firstName],
    [screen.getByLabelText('Last name'), MSG.lastName],
    [combobox('Gender'), MSG.gender],
    [screen.getByLabelText('Work email'), MSG.workEmail],
    [screen.getByLabelText('Hire date'), MSG.dateMissing('hire date')],
    [combobox('Country'), MSG.country],
    [combobox('Department'), MSG.department],
    [combobox('Role'), MSG.role],
    [combobox('Level'), MSG.level],
    [screen.getByLabelText('Salary'), MSG.salary],
  ];
  for (const [field, message] of expected) expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
  expect(screen.getByLabelText('First name')).toHaveFocus();
  expect(calls.some((c) => c.method === 'POST')).toBe(false); // checked before sending

  await fillValid();
  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));
  expect(await screen.findByText(MSG.codeUsed('E010001'))).toBeInTheDocument();
  expect(code).toHaveAccessibleDescription(expect.stringContaining(MSG.codeUsed('E010001')));
  expect(code).toHaveFocus();
});
