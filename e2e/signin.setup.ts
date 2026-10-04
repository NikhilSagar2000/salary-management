import { expect, test as setup } from '@playwright/test';
import { AUTH_STATE, E2E_PASSWORD } from './env.ts';

setup('sign in as HR', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
  await page.context().storageState({ path: AUTH_STATE });
});
