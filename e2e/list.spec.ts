import { expect, test, type Page } from '@playwright/test';
import { pick } from './helpers.ts';

const names = (page: Page) => page.getByRole('table').getByRole('link').allTextContents();
const salaries = async (page: Page) =>
  (await page.getByRole('table').locator('tbody td:nth-child(7)').allTextContents()).map((s) => Number(s.replace(/\D/g, '')));
const sorted = (xs: number[], dir: 'asc' | 'desc') => xs.length > 1 && xs.every((x, i) => i === 0 || (dir === 'asc' ? xs[i - 1]! <= x : xs[i - 1]! >= x));

test('list state survives reload, copied link and back/forward', async ({ page, context }) => {
  await page.goto('/employees');
  await pick(page, page, 'Country', 'Brazil');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/country=BR/);
  await page.getByLabel('Search').fill('Silva');
  await expect(page).toHaveURL(/q=Silva/);
  const salary = page.getByRole('columnheader', { name: 'Salary' });
  await salary.getByRole('button').click();
  await expect.poll(async () => sorted(await salaries(page), 'asc')).toBe(true);
  const ascending = await names(page);
  await salary.getByRole('button').click();
  await expect.poll(async () => sorted(await salaries(page), 'desc')).toBe(true);
  await expect(salary).toHaveAttribute('aria-sort', 'descending');
  const url = page.url();
  const shown = await names(page);
  expect(shown).not.toEqual(ascending);
  for (const name of shown) expect(name).toContain('Silva');

  await page.reload();
  expect(page.url()).toBe(url);
  await expect(page.getByLabel('Search')).toHaveValue('Silva');
  await expect.poll(() => names(page)).toEqual(shown);

  const copied = await context.newPage();
  await copied.goto(url);
  await expect(copied.getByRole('columnheader', { name: 'Salary' })).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(() => names(copied)).toEqual(shown);

  await page.goBack();
  await expect(salary).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(() => names(page)).toEqual(ascending);
  await page.goForward();
  await expect(salary).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(() => names(page)).toEqual(shown);
});
