import { screen } from '@testing-library/react';
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

test.fails('code and hire date are read-only', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'Ana Silva' })).toBeInTheDocument();
  const facts = screen.getByRole('list', { name: 'Employee facts' });
  expect(facts).toHaveTextContent('Employee codeE000123');
  expect(facts).toHaveTextContent('Hired29 Feb 2024');
  expect(screen.queryByRole('textbox', { name: /code|hire/i })).not.toBeInTheDocument();
});
