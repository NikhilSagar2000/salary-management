import { expect, test } from '@playwright/test';
import { E2E_PASSWORD } from './env.ts';

test.use({ storageState: { cookies: [], origins: [] } });

test('signed-out visit redirects and returns', async ({ page }) => {
  await page.goto('/employees?country=JP&level=7');
  await expect(page).toHaveURL(/\/signin\?next=/);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/employees?country=JP&level=7');
  await expect(page.getByRole('table')).toContainText('Japan');
});
