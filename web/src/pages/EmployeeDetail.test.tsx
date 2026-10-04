import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { detailResponse } from '../test/fixtures.ts';
import { renderApp } from '../test/render.tsx';

const open = (detail = detailResponse(), extra = {}) => {
  const calls = fakeApi({
    'GET /api/session': () => ({ status: 200, body: { signedIn: true } }),
    'GET /api/employees/E000123': () => ({ status: 200, body: detail }),
    ...extra,
  });
  renderApp('/employees/E000123');
  return calls;
};

test('code and hire date are read-only', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'Ana Silva' })).toBeInTheDocument();
  const facts = screen.getByRole('list', { name: 'Employee facts' });
  expect(facts).toHaveTextContent('Employee codeE000123');
  expect(facts).toHaveTextContent('Hired29 Feb 2024');
  expect(screen.queryByRole('textbox', { name: /code|hire/i })).not.toBeInTheDocument();
});

test("shows peers' position, manager flag, reports and the history timeline", async () => {
  open();
  const job = await screen.findByRole('region', { name: 'Current job' });
  expect(job).toHaveTextContent('Software Engineer, L4');
  expect(job).toHaveTextContent('Engineering, Brazil');
  expect(job).toHaveTextContent('BRL 145,000');
  expect(within(job).getByRole('link', { name: 'Bruno Lima' })).toHaveAttribute('href', '/employees/E000200');
  expect(job).toHaveTextContent('Bruno Lima (has left)');

  const peers = screen.getByRole('region', { name: 'Pay against peers' });
  expect(peers).toHaveTextContent('12% above the median of 48 peers');
  expect(peers).toHaveTextContent('BRL: median 129,000, min 98,000, max 170,000');

  expect(within(screen.getByRole('region', { name: 'Direct reports' })).getByRole('link', { name: 'Carla Souza' }))
    .toHaveAttribute('href', '/employees/E000301');

  const items = within(screen.getByRole('list', { name: 'History' })).getAllByRole('listitem');
  expect(items.map((i) => i.textContent)).toEqual([
    expect.stringContaining('1 Feb 2027'),
    expect.stringContaining('1 Jan 2027'),
    expect.stringContaining('1 Apr 2025'),
    expect.stringContaining('29 Feb 2024'),
  ]);
  expect(items[0]).toHaveTextContent('Cancelled');
  expect(items[0]).toHaveTextContent('Manager: Bruno Lima → none');
  expect(items[1]).toHaveTextContent('Scheduled');
  expect(items[1]).toHaveTextContent('Salary: BRL 145,000 → BRL 150,000');
  expect(items[2]).toHaveTextContent('Level: L3 → L4');
  expect(items[2]).toHaveTextContent('Promotion to L4');
  expect(items[3]).toHaveTextContent('Hired');
  expect(items[3]).toHaveTextContent('Country: Brazil');
});

test.fails('invalid fields show their messages and focus the first', async () => {
  const calls = open(detailResponse(), {
    'PATCH /api/employees/E000123': () => ({ status: 400, body: { error: 'Some fields need fixing.', fields: { workEmail: 'That work email is already used.' } } }),
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
  const first = within(dialog).getByLabelText('First name');
  expect(first).toHaveValue('Ana');
  await userEvent.clear(first);
  await userEvent.clear(within(dialog).getByLabelText('Work email'));
  await userEvent.type(within(dialog).getByLabelText('Work email'), 'not an email');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

  expect(within(dialog).getByText('Enter a first name.')).toBeInTheDocument();
  expect(within(dialog).getByText('Enter a work email, like name@acme.example.')).toBeInTheDocument();
  expect(first).toHaveFocus();
  expect(first).toHaveAccessibleDescription('Enter a first name.');
  expect(calls.some((c) => c.method === 'PATCH')).toBe(false); // checked before sending

  await userEvent.type(first, 'Anna');
  await userEvent.clear(within(dialog).getByLabelText('Work email'));
  await userEvent.type(within(dialog).getByLabelText('Work email'), 'taken@acme.example');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(await within(dialog).findByText('That work email is already used.')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Work email')).toHaveFocus();
  expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
    version: 4, firstName: 'Anna', lastName: 'Silva', gender: 'female', workEmail: 'taken@acme.example',
  });
});
