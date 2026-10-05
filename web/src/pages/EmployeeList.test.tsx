import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { listResponse } from '../test/fixtures.ts';
import { renderApp } from '../test/render.tsx';
import { setPhone } from '../test/setup.ts';

const signedInWith = (list = listResponse()) =>
  fakeApi({
    'GET /api/session': () => ({ status: 200, body: { signedIn: true } }),
    'GET /api/employees': () => ({ status: 200, body: list }),
  });

test('salary controls are disabled with the note unless one country is chosen', async () => {
  signedInWith();
  const mixed = renderApp('/employees');
  const min = await screen.findByLabelText('Salary from');
  expect(min).toBeDisabled();
  expect(screen.getByLabelText('Salary to')).toBeDisabled();
  expect(screen.getByText('Choose one country to sort or filter by salary, because salaries are in different currencies.')).toBeInTheDocument();
  mixed.unmount();

  signedInWith();
  renderApp('/employees?country=BR');
  expect(await screen.findByLabelText('Salary from')).toBeEnabled();
  expect(screen.queryByText(/Choose one country to sort or filter by salary/)).not.toBeInTheDocument();
});

test('search, filters, sort and page are read from and written to the URL', async () => {
  const calls = signedInWith(listResponse({ total: 120 }));
  renderApp('/employees?q=ana&country=BR&sort=salary&dir=desc&page=2');
  expect(await screen.findByLabelText('Search')).toHaveValue('ana');
  const apiQuery = () => calls.filter((c) => c.url.pathname === '/api/employees').at(-1)!.url.search;
  expect(apiQuery()).toBe('?q=ana&country=BR&sort=salary&dir=desc&page=2');
  expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'descending');

  await userEvent.clear(screen.getByLabelText('Search'));
  await userEvent.type(screen.getByLabelText('Search'), 'kim');
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/employees?q=kim&country=BR&sort=salary&dir=desc'));

  await userEvent.click(screen.getByRole('button', { name: 'Level' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/employees?q=kim&country=BR&sort=level&dir=asc');
  await userEvent.click(screen.getByRole('button', { name: 'Level' }));
  expect(screen.getByTestId('location')).toHaveTextContent('sort=level&dir=desc');

  await userEvent.click(await screen.findByRole('button', { name: '3' }));
  expect(screen.getByTestId('location')).toHaveTextContent('sort=level&dir=desc&page=3');
  await waitFor(() => expect(apiQuery()).toBe('?q=kim&country=BR&sort=level&dir=desc&page=3'));
});

test('rows show the listed columns, as a table and as phone cards', async () => {
  signedInWith();
  renderApp('/employees');
  const table = await screen.findByRole('table');
  const [, ana] = within(table).getAllByRole('row');
  expect(within(ana!).getAllByRole('cell').map((c) => c.textContent)).toEqual([
    'E000123', 'Ana Silva', 'Brazil', 'Engineering', 'Software Engineer', 'L3', 'BRL 133,000', '29 Feb 2024', 'Active',
  ]);
  expect(within(ana!).getByRole('link', { name: 'Ana Silva' })).toHaveAttribute('href', '/employees/E000123');

  const cards = screen.getByRole('list', { name: 'Employees' });
  const [anaCard, kenjiCard] = within(cards).getAllByRole('listitem');
  expect(anaCard).toHaveTextContent('Ana Silva');
  expect(anaCard).toHaveTextContent('Software Engineer · L3');
  expect(anaCard).toHaveTextContent('BRL 133,000');
  expect(kenjiCard).toHaveTextContent('Starting');
  expect(within(anaCard!).getByRole('link', { name: 'Ana Silva' })).toHaveAttribute('href', '/employees/E000123');
});

test('no matches shows the empty state', async () => {
  signedInWith(listResponse({ rows: [], total: 0 }));
  renderApp('/employees?country=JP&q=zz');
  expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/employees$/);
});

test('the search box follows the URL when it changes elsewhere', async () => {
  signedInWith(listResponse({ rows: [], total: 0 }));
  renderApp('/employees?q=zz');
  expect(await screen.findByLabelText('Search')).toHaveValue('zz');
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByLabelText('Search')).toHaveValue('');
});

test('export downloads the current filter', async () => {
  signedInWith(listResponse({ total: 200 }));
  renderApp('/employees?country=US&department=Sales&sort=hireDate&dir=desc&page=3&pageSize=50');
  expect(await screen.findByRole('link', { name: 'Export CSV' })).toHaveAttribute(
    'href', `/api/employees.csv?country=US&department=Sales&sort=hireDate&dir=desc&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
  );
});

test('on a phone the filters open in a drawer', async () => {
  setPhone();
  signedInWith();
  renderApp('/employees?country=BR');
  expect(await screen.findByLabelText('Search')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Country' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Filters (1)' }));
  const drawer = await screen.findByRole('dialog', { name: 'Filters' });
  expect(within(drawer).getByRole('combobox', { name: 'Department' })).toBeInTheDocument();
  expect(within(drawer).getByLabelText('Salary from')).toBeEnabled();
});

test("the export link carries the browser's timezone", async () => {
  signedInWith();
  renderApp('/employees?country=US');
  const href = (await screen.findByRole('link', { name: 'Export CSV' })).getAttribute('href')!;
  expect(new URL(href, 'http://localhost').searchParams.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('the search box takes at most 100 characters, as the search does', async () => {
  signedInWith();
  renderApp('/employees');
  expect(await screen.findByLabelText('Search')).toHaveAttribute('maxlength', '100');
});

test('the list shows no pay summary (removed, D71)', async () => {
  signedInWith();
  renderApp('/employees');
  await screen.findByRole('table');
  expect(screen.queryByRole('list', { name: 'Pay for these employees' })).not.toBeInTheDocument();
  expect(screen.queryByText(/median/)).not.toBeInTheDocument();
});

test.fails('a filter picked while the search is still waiting to apply is kept', async () => {
  signedInWith();
  renderApp('/employees');
  const search = await screen.findByLabelText('Search');
  await userEvent.click(screen.getByRole('combobox', { name: 'Country' }));
  const germany = await screen.findByRole('option', { name: 'Germany' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    act(() => {
      fireEvent.change(search, { target: { value: 'Albrecht' } });
    });
    // The search's delayed write lands before the router has re-rendered with the country (the CI failure's timing).
    act(() => {
      fireEvent.click(germany);
      vi.advanceTimersByTime(300);
    });
  } finally {
    vi.useRealTimers();
  }
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('q=Albrecht'));
  expect(screen.getByTestId('location')).toHaveTextContent('country=DE');
});
