import type { Locator, Page } from '@playwright/test';

/** Picks an option in a Mantine multi-select. Its visible box takes the click; the input inside it is covered. */
export async function pick(page: Page, scope: Page | Locator, label: string, option: string) {
  await scope.locator('.mantine-MultiSelect-input', { has: page.getByRole('combobox', { name: label }) }).click();
  await page.getByRole('option', { name: option }).click();
}
