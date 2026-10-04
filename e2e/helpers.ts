import type { Locator, Page } from '@playwright/test';

/** Picks an option in a Mantine multi-select. Its visible box takes the click; the input inside it is covered. */
export async function pick(page: Page, scope: Page | Locator, label: string, option: string) {
  await scope.locator('.mantine-MultiSelect-input', { has: page.getByRole('combobox', { name: label }) }).click();
  await page.getByRole('option', { name: option }).click();
}

/** Presses Tab until `target` has focus; fails if the keyboard can't reach it. */
export async function tabTo(page: Page, target: Locator, max = 120) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${target}`);
}

/** With a Mantine select focused: opens it and moves with the arrow keys to `option`, then picks it with Enter. */
export async function chooseWithKeys(page: Page, option: string) {
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 40; i++) {
    const highlighted = page.locator('[data-combobox-selected]');
    if ((await highlighted.count()) && (await highlighted.first().textContent())?.trim() === option) {
      await page.keyboard.press('Enter');
      return;
    }
    await page.keyboard.press('ArrowDown');
  }
  throw new Error(`The arrow keys never reached "${option}"`);
}

/**
 * Types an ISO date into a native date field with the keyboard alone. The field's parts follow the operating system's
 * locale (Playwright's `locale` doesn't change them on macOS), so a probe date shows the order first.
 */
export async function typeDate(page: Page, input: Locator, iso: string) {
  const [y, m, d] = iso.split('-') as [string, string, string];
  await tabTo(page, input);
  await page.keyboard.type('01022003');
  const probe = await input.inputValue();
  const parts = probe === '2003-01-02' ? [m, d, y] : probe === '2003-02-01' ? [d, m, y] : [y, m, d];
  await page.keyboard.press('Shift+Tab'); // inside the field, Shift+Tab steps back one part
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.type(parts.join(''));
}
