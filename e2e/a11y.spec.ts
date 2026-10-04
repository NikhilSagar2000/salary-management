import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** A chat with one answer from the fake model, so the assistant screen is checked with content. */
async function chatWithAnswer(page: Page) {
  const chat = await (await page.request.post('/api/chats')).json();
  await page.request.post(`/api/chats/${chat.id}/messages`, { data: { question: 'Who are the engineers in Brazil?' } });
  return `/assistant/${chat.id}`;
}

async function seriousProblems(page: Page) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.slice(0, 4).map((n) => `${v.id}: ${n.html.slice(0, 140)} → ${(n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim()}`));
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const { size, viewport } of [{ size: 'desktop', viewport: { width: 1440, height: 900 } }, { size: 'phone', viewport: { width: 375, height: 812 } }]) {
    test.describe(`${colorScheme}, ${size}`, () => {
      test.use({ colorScheme, viewport });

      test(`no serious or critical axe problems on every screen (${colorScheme}, ${size})`, async ({ page, browser }) => {
        const screens = ['/employees', '/employees/E000001', '/employees/new', '/pay', '/import', '/assistant', await chatWithAnswer(page)];
        for (const path of screens) {
          await page.goto(path);
          expect.soft(await seriousProblems(page), path).toEqual([]);
        }
        // Open states: the edit dialog, and the phone filter drawer.
        await page.goto('/employees/E000001');
        await page.getByRole('button', { name: 'Change job or pay' }).click();
        expect.soft(await seriousProblems(page), 'change job dialog').toEqual([]);
        if (size === 'phone') {
          await page.goto('/employees');
          await page.getByRole('button', { name: 'Filters', exact: true }).click();
          expect.soft(await seriousProblems(page), 'filter drawer').toEqual([]);
        }
        // Signed out: the sign-in page.
        const signedOut = await browser.newContext({ colorScheme, viewport, baseURL: test.info().project.use.baseURL });
        const signIn = await signedOut.newPage();
        await signIn.goto('/signin');
        expect.soft(await seriousProblems(signIn), '/signin').toEqual([]);
        await signedOut.close();
      });
    });
  }
}
