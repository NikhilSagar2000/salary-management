import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from './fakeApi.ts';
import { renderApp } from './render.tsx';
import { setPrefersDark } from './setup.ts';

test('signed-out visit goes to sign-in and returns afterwards', async () => {
  let signedIn = false;
  fakeApi({
    'GET /api/session': () => (signedIn ? { status: 200, body: { signedIn: true } } : { status: 401, body: { error: 'Please sign in.' } }),
    'POST /api/session': ({ body }) => {
      if ((body as { password: string }).password !== 'right one') return { status: 401, body: { error: "That password isn't right." } };
      signedIn = true;
      return { status: 204 };
    },
  });
  renderApp('/pay?country=DE');
  const password = await screen.findByLabelText('Password');
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/signin?next=%2Fpay%3Fcountry%3DDE');

  await userEvent.type(password, 'wrong');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText("That password isn't right.")).toBeInTheDocument();

  await userEvent.clear(password);
  await userEvent.type(password, 'right one{Enter}');
  expect(await screen.findByRole('heading', { name: 'Pay overview' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/pay?country=DE');
});

const signedIn = () => fakeApi({ 'GET /api/session': () => ({ status: 200, body: { signedIn: true } }) });
const scheme = () => document.documentElement.getAttribute('data-mantine-color-scheme');

test('theme follows the device and the toggle is remembered', async () => {
  signedIn();
  setPrefersDark(true);
  const first = renderApp('/employees');
  await screen.findByRole('heading', { name: 'Employees' });
  expect(scheme()).toBe('dark');
  await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
  expect(scheme()).toBe('light');
  first.unmount();

  renderApp('/employees'); // the device still prefers dark, the choice is remembered
  await screen.findByRole('heading', { name: 'Employees' });
  expect(scheme()).toBe('light');
  expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
});
