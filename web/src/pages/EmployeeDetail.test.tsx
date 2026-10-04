import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { detailResponse } from '../test/fixtures.ts';
import { renderApp } from '../test/render.tsx';

const open = (detail = detailResponse(), extra: Parameters<typeof fakeApi>[0] = {}) => {
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

test('invalid fields show their messages and focus the first', async () => {
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

test('a 409 keeps the typed input and offers Reload', async () => {
  let version = 4;
  const calls = open(undefined, {
    'GET /api/employees/E000123': () => ({ status: 200, body: detailResponse({ version }) }),
    'PATCH /api/employees/E000123': ({ body }) => {
      if ((body as { version: number }).version !== version) {
        return { status: 409, body: { error: 'Someone changed this employee after you opened the page. Reload to see the latest, then make your change again.' } };
      }
      return { status: 200, body: { code: 'E000123', version: version + 1 } };
    },
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
  version = 5; // someone else saved meanwhile
  await userEvent.clear(within(dialog).getByLabelText('Last name'));
  await userEvent.type(within(dialog).getByLabelText('Last name'), 'Souza');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Someone changed this employee after you opened the page.');
  expect(within(dialog).getByLabelText('Last name')).toHaveValue('Souza');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Reload' }));
  await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
  expect(within(dialog).getByLabelText('Last name')).toHaveValue('Souza'); // still there after reloading
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(calls.filter((c) => c.method === 'PATCH').map((c) => (c.body as { version: number }).version)).toEqual([4, 5]);
});

test('cancel appears only on scheduled changes', async () => {
  const calls = open(undefined, { 'POST /api/employees/E000123/changes/3/cancel': () => ({ status: 200, body: { code: 'E000123', version: 5 } }) });
  await screen.findByRole('list', { name: 'History' });
  const buttons = screen.getAllByRole('button', { name: /^Cancel the change on/ });
  expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Cancel the change on 1 Jan 2027']);
  await userEvent.click(buttons[0]!);
  await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/changes/3/cancel'))).toBe(true));
  expect(calls.find((c) => c.url.pathname.endsWith('/cancel'))!.body).toEqual({ version: 4 });
  await waitFor(() => expect(calls.filter((c) => c.url.pathname === '/api/employees/E000123')).toHaveLength(2)); // reloaded
});

test('change job or pay sends a dated change with only what changed', async () => {
  const calls = open(undefined, { 'POST /api/employees/E000123/changes': () => ({ status: 201, body: { code: 'E000123', version: 5 } }) });
  await userEvent.click(await screen.findByRole('button', { name: 'Change job or pay' }));
  const dialog = await screen.findByRole('dialog', { name: 'Change job or pay' });
  expect(within(dialog).getByLabelText('Salary')).toHaveValue('145,000'); // starts from the current job

  fireEvent.change(within(dialog).getByLabelText('Effective date'), { target: { value: '2026-11-01' } });
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Country' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Germany' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save change' }));
  expect(await within(dialog).findByText('Moving to another country needs a salary in the new currency.')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Salary')).toHaveFocus();

  await userEvent.clear(within(dialog).getByLabelText('Salary'));
  await userEvent.type(within(dialog).getByLabelText('Salary'), '90000');
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Level' }));
  await userEvent.click(await screen.findByRole('option', { name: 'L5' }));
  await userEvent.type(within(dialog).getByLabelText('Note'), 'Moving to Berlin');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save change' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
    version: 4, effectiveDate: '2026-11-01', country: 'DE', level: 5, salary: 90000, note: 'Moving to Berlin',
  });
});

test('mark as leaving, then only Undo is offered', async () => {
  const calls = open(undefined, { 'POST /api/employees/E000123/leave': () => ({ status: 200, body: { code: 'E000123', version: 5 } }) });
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as leaving' }));
  const dialog = await screen.findByRole('dialog', { name: 'Mark as leaving' });
  fireEvent.change(within(dialog).getByLabelText('Leave date'), { target: { value: '2026-12-31' } });
  await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Moving abroad');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(calls.find((c) => c.url.pathname.endsWith('/leave'))!.body).toEqual({ version: 4, leaveDate: '2026-12-31', reason: 'Moving abroad' });
});

test('after leaving only Undo is offered', async () => {
  const calls = open(detailResponse({ status: 'left', leaveDate: '2026-09-30', leaveReason: 'Resigned' }), {
    'POST /api/employees/E000123/undo-leave': () => ({ status: 200, body: { code: 'E000123', version: 5 } }),
  });
  const undo = await screen.findByRole('button', { name: 'Undo leaving' });
  for (const name of ['Edit details', 'Change job or pay', 'Mark as leaving']) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('button', { name: /^Cancel the change/ })).not.toBeInTheDocument();
  expect(screen.getByText('This person has left. Undo leaving first to make changes.')).toBeInTheDocument();
  await userEvent.click(undo);
  await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/undo-leave'))!.body).toEqual({ version: 4 }));
});

test("save button can't submit twice", async () => {
  let release!: () => void;
  const answered = new Promise<void>((r) => (release = r));
  const calls = open(undefined, {
    'PATCH /api/employees/E000123': async () => {
      await answered;
      return { status: 200, body: { code: 'E000123', version: 5 } };
    },
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
  const save = within(dialog).getByRole('button', { name: 'Save' });
  fireEvent.click(save);
  fireEvent.click(save); // a double click before the page re-renders
  release();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
});

test('a cancelled change says when it was cancelled', async () => {
  open();
  const items = within(await screen.findByRole('list', { name: 'History' })).getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Cancelled on 3 Oct 2026');
});

test("a starting person's hire can't be cancelled, so it offers no Cancel", async () => {
  const hire = { type: 'change', id: 1, date: '2027-01-01', hire: true, note: null, scheduled: true, cancelled: false, cancelledOn: null, wontApply: false,
    changes: [{ field: 'country', from: null, to: 'BR' }] };
  open(detailResponse({ status: 'starting', hireDate: '2027-01-01', timeline: [hire] }));
  const [item] = within(await screen.findByRole('list', { name: 'History' })).getAllByRole('listitem');
  expect(item).toHaveTextContent('Hired');
  expect(item).toHaveTextContent('Starts');
  expect(item).not.toHaveTextContent('Scheduled');
  expect(within(item!).queryByRole('button', { name: /^Cancel/ })).not.toBeInTheDocument();
});

test('leave events read Left, Leaves or Leave cancelled', async () => {
  const left = (date: string, scheduled: boolean, undone: boolean) => ({ type: 'left', date, reason: 'Moving abroad', scheduled, undone });
  open(detailResponse({ timeline: [left('2025-05-31', false, false), left('2026-12-31', true, true), left('2027-03-31', true, false)] }));
  const items = within(await screen.findByRole('list', { name: 'History' })).getAllByRole('listitem');
  expect(items.map((i) => i.querySelector('.mantine-Badge-label')?.textContent)).toEqual(['Leaves', 'Leave cancelled', 'Left']);
  expect(within(items[1]!).getByText('Moving abroad')).toHaveStyle({ textDecoration: 'line-through' });
});
