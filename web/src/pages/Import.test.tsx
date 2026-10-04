import { MSG } from '@acme/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi } from '../test/fakeApi.ts';
import { renderApp } from '../test/render.tsx';

const csv = 'code,first_name,last_name,gender,work_email,country,department,role,level,salary,hire_date\n'
  + 'E010001,Lucas,Pereira,male,lucas.pereira@acme.example,BR,Engineering,Software Engineer,2,80000,2026-10-05\n';
const row = (code: string, firstName: string, line: number) => ({
  line, code, firstName, lastName: 'Pereira', gender: 'male', workEmail: `${firstName.toLowerCase()}@acme.example`, country: 'BR',
  currency: 'BRL', department: 'Engineering', role: 'Software Engineer', level: 2, salary: 80000, hireDate: '2026-10-05', managerCode: null,
});

const start = (routes: Parameters<typeof fakeApi>[0]) => {
  const calls = fakeApi({ 'GET /api/session': () => ({ status: 200, body: { signedIn: true } }), ...routes });
  renderApp('/import');
  return calls;
};
const upload = async () => userEvent.upload(await screen.findByLabelText('CSV file'), new File([csv], 'people.csv', { type: 'text/csv' }));
const tableRows = (name: string) =>
  within(screen.getByRole('table', { name })).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));

test('preview shows rows and problems by row and column', async () => {
  const calls = start({
    'POST /api/imports/preview': () => ({
      status: 200,
      body: {
        rows: [row('E010001', 'Lucas', 2)],
        problems: [
          { line: 0, column: '', message: MSG.importUnknownColumns(['nickname']) },
          { line: 3, column: 'salary', message: MSG.salarySeparators },
        ],
      },
    }),
  });
  await upload();

  expect(await screen.findByText('1 row ready to import, 2 problems to fix first. Nothing has been saved.')).toBeInTheDocument();
  expect(tableRows('Problems')).toEqual([
    ['Whole file', '', MSG.importUnknownColumns(['nickname'])],
    ['Row 3', 'salary', MSG.salarySeparators],
  ]);
  const preview = tableRows('Rows to import');
  expect(preview).toHaveLength(1);
  expect(preview[0]!.join(' ')).toMatch(/Row 2.*Lucas Pereira.*E010001.*Software Engineer, L2.*BRL 80,000.*5 Oct 2026/);
  expect(screen.getByRole('button', { name: /^Import/ })).toBeDisabled();

  const sent = calls.find((c) => c.url.pathname === '/api/imports/preview')!;
  expect(sent.body).toBe(csv);
  expect(sent.headers.get('content-type')).toMatch(/^text\/csv/);
  expect(calls.some((c) => c.url.pathname === '/api/imports')).toBe(false);
});

test('Import is enabled only with no problems and shows the result', async () => {
  let taken = true; // someone uses E010001 between the preview and the import
  const calls = start({
    'POST /api/imports/preview': () => ({ status: 200, body: { rows: [row('E010001', 'Lucas', 2), row('E010002', 'Rafael', 3)], problems: [] } }),
    'POST /api/imports': () => (taken
      ? { status: 400, body: { error: MSG.importNothingSaved, problems: [{ line: 2, column: 'code', message: MSG.codeUsed('E010001') }] } }
      : { status: 201, body: { imported: 2 } }),
  });
  await upload();
  expect(await screen.findByText('2 rows ready to import, no problems.')).toBeInTheDocument();
  expect(screen.queryByRole('table', { name: 'Problems' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Import 2 employees' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(MSG.importNothingSaved);
  expect(tableRows('Problems')).toEqual([['Row 2', 'code', MSG.codeUsed('E010001')]]);
  expect(screen.getByRole('button', { name: /^Import/ })).toBeDisabled();

  taken = false;
  await upload(); // fixed and chosen again
  await userEvent.click(await screen.findByRole('button', { name: 'Import 2 employees' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Imported 2 employees.');
  expect(screen.getByRole('link', { name: 'See them in the employee list' })).toHaveAttribute('href', '/employees?sort=code&dir=desc');
  expect(screen.queryByRole('table', { name: 'Rows to import' })).not.toBeInTheDocument();
  await waitFor(() => expect(calls.filter((c) => c.url.pathname === '/api/imports').map((c) => c.body)).toEqual([csv, csv]));
});
