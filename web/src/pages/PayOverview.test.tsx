import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { listResponse } from '../test/fixtures.ts';
import { renderApp } from '../test/render.tsx';

const overview = {
  US: { country: 'US', currency: 'USD', cells: [{ department: 'Engineering', level: 4, median: 170000, min: 150000, max: 210000, headcount: 12 }] },
  BR: { country: 'BR', currency: 'BRL', cells: [{ department: 'Sales', level: 2, median: 80000, min: 80000, max: 80000, headcount: 1 }] },
};

test.fails('one country at a time, empty cells show —, a cell opens the matching list', async () => {
  const calls = fakeApi({
    'GET /api/session': () => ({ status: 200, body: { signedIn: true } }),
    'GET /api/pay-overview': ({ url }) => ({ status: 200, body: overview[url.searchParams.get('country') as 'US' | 'BR'] }),
    'GET /api/employees': () => ({ status: 200, body: listResponse() }),
  });
  renderApp('/pay');

  let table = await screen.findByRole('table', { name: 'Pay in United States by department and level' });
  const engineering = within(table).getByRole('row', { name: /^Engineering/ });
  const cells = within(engineering).getAllByRole('cell');
  expect(cells.map((c) => c.textContent)).toEqual(['—', '—', '—', expect.stringContaining('USD 170,000'), '—', '—', '—']);
  expect(cells[3]).toHaveTextContent('150,000 to 210,000');
  expect(cells[3]).toHaveTextContent('12 people');
  expect(within(table).getAllByRole('row')).toHaveLength(10); // header + 9 departments

  await userEvent.click(screen.getByRole('combobox', { name: 'Country' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Brazil' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/pay?country=BR'));
  table = await screen.findByRole('table', { name: 'Pay in Brazil by department and level' });
  expect(calls.filter((c) => c.url.pathname === '/api/pay-overview').map((c) => c.url.search)).toEqual(['?country=US', '?country=BR']);
  expect(within(table).getByRole('row', { name: /^Engineering/ })).not.toHaveTextContent('USD');

  await userEvent.click(within(table).getByRole('link', { name: 'Sales, L2: median BRL 80,000, 1 person' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/employees?country=BR&department=Sales&level=2'));
});
