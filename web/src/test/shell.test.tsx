import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { api } from '../api.ts';
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

test('a failed request shows a plain message', async () => {
  let fail: 'server' | 'network' | null = 'server';
  fakeApi({
    'GET /api/session': () => {
      if (fail === 'server') return { status: 500, body: { error: 'Something went wrong on our side. Try again in a minute.' } };
      if (fail === 'network') throw new TypeError('Failed to fetch');
      return { status: 200, body: { signedIn: true } };
    },
  });
  renderApp('/employees');
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side. Try again in a minute.');
  fail = 'network';
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection and try again.");
  fail = null;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
});

test("every API request sends the browser's timezone", async () => {
  const calls = fakeApi({ 'GET /api/x': () => ({ status: 200, body: {} }), 'POST /api/y': () => ({ status: 204 }) });
  await api('/api/x');
  await api('/api/y', { method: 'POST', body: { a: 1 } });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  expect(zone).toBeTruthy();
  expect(calls.map((c) => c.headers.get('x-timezone'))).toEqual([zone, zone]);
});

test('sign out ends the session and returns to sign-in', async () => {
  let signedIn = true;
  const calls = fakeApi({
    'GET /api/session': () => (signedIn ? { status: 200, body: { signedIn: true } } : { status: 401, body: { error: 'Please sign in.' } }),
    'DELETE /api/session': () => {
      signedIn = false;
      return { status: 204 };
    },
  });
  renderApp('/employees');
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/api/session')).toBe(true);
});

test('after sign-in, a next address on another site is ignored', async () => {
  for (const next of ['//evil.example/x', '/\\evil.example/x']) {
    let signedIn = false;
    fakeApi({
      'GET /api/session': () => (signedIn ? { status: 200, body: { signedIn: true } } : { status: 401, body: { error: 'Please sign in.' } }),
      'POST /api/session': () => {
        signedIn = true;
        return { status: 204 };
      },
      'GET /api/employees': () => ({ status: 200, body: { rows: [], total: 0, page: 1, pageSize: 25, stats: [] } }),
    });
    const { unmount } = renderApp(`/signin?next=${encodeURIComponent(next)}`);
    await userEvent.type(await screen.findByLabelText('Password'), 'right one{Enter}');
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/employees');
    unmount();
  }
});
