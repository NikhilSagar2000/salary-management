import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const FILTER = 'country=JP&department=Engineering&level=7';
const HEADER = 'code,first_name,last_name,gender,work_email,country,department,role,level,salary,currency,hire_date,manager_code,status,leave_date,leave_reason';

test('export, then import new rows with a preview', async ({ page }) => {
  await page.goto(`/employees?${FILTER}`);
  const { total } = await (await page.request.get(`/api/employees?${FILTER}`)).json();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export CSV' }).click();
  const csv = await readFile(await (await download).path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff); // a byte-order mark, so Excel reads UTF-8
  const [header, ...lines] = csv.slice(1).trim().split(/\r?\n/);
  expect(header).toBe(HEADER);
  expect(lines).toHaveLength(total);

  // Three exported people become three new people: new codes and emails, the leave columns left empty.
  const rows = lines.slice(0, 3).map((line, i) => {
    expect(line).not.toContain('"');
    const cells = line.split(',');
    cells[0] = `E09000${i + 1}`;
    cells[4] = `e2e.import.${i + 1}@acme.example`;
    cells[13] = cells[14] = cells[15] = '';
    return cells.join(',');
  });
  const file = (body: string[]) => ({ name: 'new-people.csv', mimeType: 'text/csv', buffer: Buffer.from([header, ...body].join('\n')) });

  await page.goto('/import');
  const picker = page.getByLabel('CSV file');
  const taken = rows[0]!.replace('E090001', 'E000001').replace('e2e.import.1@', 'e2e.import.9@'); // a code already in use
  await picker.setInputFiles(file([...rows, taken]));
  await expect(page.getByText('3 rows ready to import, 1 problem to fix first. Nothing has been saved.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Problems' })).toContainText('Row 5');
  await expect(page.getByRole('table', { name: 'Problems' })).toContainText('E000001 is already used.');
  await expect(page.getByRole('button', { name: /^Import/ })).toBeDisabled();

  await picker.setInputFiles(file(rows));
  await expect(page.getByText('3 rows ready to import, no problems.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Rows to import' }).getByRole('row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Import 3 employees' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 3 employees.');
  await page.getByRole('link', { name: 'See them in the employee list' }).click();
  await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('E090003');
});
