import { screen, waitFor } from '@testing-library/react';
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
