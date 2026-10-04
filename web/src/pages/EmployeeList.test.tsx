import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { listResponse } from '../test/fixtures.ts';
import { renderApp } from '../test/render.tsx';

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

test('stats line per currency above the list', async () => {
  signedInWith(listResponse({
    stats: [
      { currency: 'USD', median: 128000, min: 62000, max: 410000, headcount: 2914 },
      { currency: 'INR', median: 1550000, min: 480000, max: 9800000, headcount: 1 },
    ],
  }));
  renderApp('/employees');
  const summary = await screen.findByRole('list', { name: 'Pay for these employees' });
  expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'USD: median 128,000, min 62,000, max 410,000, 2,914 people',
    'INR: median 1,550,000, min 480,000, max 9,800,000, 1 person',
  ]);
});

test('no matches shows the empty state and no stats', async () => {
  signedInWith(listResponse({ rows: [], total: 0, stats: [] }));
  renderApp('/employees?country=JP&q=zz');
  expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Pay for these employees' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/employees$/);
});

test('the search box follows the URL when it changes elsewhere', async () => {
  signedInWith(listResponse({ rows: [], total: 0, stats: [] }));
  renderApp('/employees?q=zz');
  expect(await screen.findByLabelText('Search')).toHaveValue('zz');
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByLabelText('Search')).toHaveValue('');
});

test('export downloads the current filter', async () => {
  signedInWith(listResponse({ total: 200 }));
  renderApp('/employees?country=US&department=Sales&sort=hireDate&dir=desc&page=3&pageSize=50');
  expect(await screen.findByRole('link', { name: 'Export CSV' })).toHaveAttribute(
    'href', '/api/employees.csv?country=US&department=Sales&sort=hireDate&dir=desc',
  );
});
