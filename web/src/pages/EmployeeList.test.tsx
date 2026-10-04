import { screen } from '@testing-library/react';
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
