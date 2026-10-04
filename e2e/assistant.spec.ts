import { expect, test, type Page } from '@playwright/test';

async function ask(page: Page, question: string) {
  await page.goto('/assistant');
  await page.getByRole('button', { name: 'New chat' }).click();
  await expect(page).toHaveURL(/\/assistant\/\d+$/);
  await page.getByLabel('Your question').fill(question);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('an answer streams with sources from the fake model', async ({ page }) => {
  await ask(page, 'Who are the engineers in Brazil?');
  const answer = page.getByRole('article', { name: 'Answer' }).last();
  await expect(answer).toContainText('Here are the engineers in Brazil.');
  await expect(answer.locator('strong')).toHaveText('Brazil');
  await expect(page.getByRole('status')).toHaveText('Answer finished.');
  await expect(answer).not.toContainText('Looking up people'); // steps show only while it works (D73)
  await expect(page.getByRole('heading', { name: 'Who are the engineers in Brazil?' })).toBeVisible();

  const basedOn = answer.getByRole('region', { name: 'Based on' });
  await expect(basedOn.getByRole('link')).toHaveCount(6); // the group and the five people listed
  await basedOn.getByRole('link', { name: /^Brazil · Engineering \(\d[\d,]* people\)$/ }).click();
  await expect(page).toHaveURL(/\/employees\?.*country=BR/);
  await expect(page).toHaveURL(/department=Engineering/);
  await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Engineering');
});

test('rate limit message appears and other pages keep working', async ({ page }) => {
  await ask(page, 'How many people work here? [429]');
  await expect(page.getByRole('article', { name: 'Answer' }).last()).toContainText(
    'The free AI model limit has been reached. Try again later; everything else in the app still works.',
  );
  await page.reload(); // the question and the message were saved
  await expect(page.getByRole('article', { name: 'Question' })).toContainText('How many people work here? [429]');
  await page.getByRole('link', { name: 'Employees' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('link', { name: 'Pay overview' }).click();
  await expect(page.getByRole('table', { name: /^Pay in United States/ })).toBeVisible();
});

test('the browser never calls openrouter.ai', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  await ask(page, 'Who are the engineers in Brazil?');
  await expect(page.getByRole('status')).toHaveText('Answer finished.');
  expect([...hosts]).toEqual(['localhost:4733']);
});

test("Stop doesn't send what is waiting in the question box (AST-12)", async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/messages') && sent.push(r.url()));
  await ask(page, 'Give me a long answer [slow]');
  const answer = page.getByRole('article', { name: 'Answer' }).last();
  await expect(answer).toContainText('word3');
  await page.getByLabel('Your question').fill('a second question');
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(answer).toContainText('Stopped');
  await expect(page.getByLabel('Your question')).toHaveValue('a second question');
  await expect(page.getByText('Wait for the current answer to finish, or stop it.')).toHaveCount(0);
  expect(sent).toHaveLength(1);
});

test.fail('the chat list and the messages scroll separately; the question box stays in view (AST-19)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  for (let i = 0; i < 20; i++) await page.request.post('/api/chats');
  const chat = await (await page.request.post('/api/chats')).json();
  for (let i = 0; i < 3; i++) await page.request.post(`/api/chats/${chat.id}/messages`, { data: { question: 'Who are the engineers in Brazil?' } });
  await page.goto(`/assistant/${chat.id}`);
  const list = page.getByRole('navigation', { name: 'Chats' });
  const messages = page.getByRole('region', { name: 'Messages' });
  await expect(messages.getByRole('article', { name: 'Answer' })).toHaveCount(3);
  const top = (l: typeof list) => l.evaluate((el) => el.scrollTop);

  // The page itself doesn't scroll; the chat opens at its newest message.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await expect.poll(() => top(messages)).toBeGreaterThan(0);
  const messagesAt = await top(messages);

  await list.hover();
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => top(list)).toBeGreaterThan(0);
  expect(await top(messages)).toBe(messagesAt);

  const listAt = await top(list);
  await messages.hover();
  await page.mouse.wheel(0, -3000);
  await expect.poll(() => top(messages)).toBe(0);
  expect(await top(list)).toBe(listAt);
  await expect(page.getByLabel('Your question')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'New chat' })).toBeInViewport();
});
