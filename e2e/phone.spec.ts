import { expect, test } from '@playwright/test';
import { pick } from './helpers.ts';

test('at 375 px the list shows cards and a filter drawer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/employees');
  const cards = page.getByRole('list', { name: 'Employees', exact: true });
  await expect(cards).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Country' })).toHaveCount(0); // in the drawer, not on the first screen

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Filters' });
  await pick(page, drawer, 'Country', 'Japan');
  await drawer.getByRole('button', { name: 'Show results' }).click();
  await expect(page).toHaveURL(/country=JP/);
  await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
  await expect(cards.getByRole('listitem').first()).toContainText('Japan');
});

const SCREENS = ['/employees', '/employees/E000001', '/employees/new', '/pay', '/import', '/assistant', '/signin'];

test('no screen scrolls sideways at 375 or 1440 px', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of SCREENS) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      expect.soft(scrollWidth, `${path} at ${width} px`).toBeLessThanOrEqual(innerWidth);
    }
  }
});
