import { expect, test } from '@playwright/test';
import { E2E_PASSWORD } from './env.ts';
import { chooseWithKeys, tabTo, typeDate } from './helpers.ts';

// A11Y-2: every flow with the keyboard alone. Only choosing a file uses the system's own dialog.

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('keyboard: sign in', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.keyboard.type(E2E_PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
  });
});

test('keyboard: search, filter and open an employee', async ({ page }) => {
  await page.goto('/employees');
  await tabTo(page, page.getByLabel('Search'));
  await page.keyboard.type('Albrecht');
  await tabTo(page, page.getByRole('combobox', { name: 'Country' }));
  await chooseWithKeys(page, 'Germany');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/country=DE/);
  await expect(page).toHaveURL(/q=Albrecht/);
  const first = page.getByRole('table').getByRole('link').first();
  await expect(first).toContainText('Albrecht');
  const name = (await first.textContent())!;
  await tabTo(page, first);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('keyboard: add an employee', async ({ page }) => {
  await page.goto('/employees/new');
  const code = page.getByLabel('Employee code');
  await expect(code).toHaveValue(/^E\d{6}$/);
  const fields: [string, string][] = [['First name', 'Keyboard'], ['Last name', 'Tester'], ['Work email', 'keyboard.tester@acme.example']];
  for (const [label, text] of fields) {
    await tabTo(page, page.getByLabel(label, { exact: true }));
    await page.keyboard.type(text);
  }
  await tabTo(page, page.getByRole('combobox', { name: 'Gender' }));
  await chooseWithKeys(page, 'Non-binary');
  await typeDate(page, page.getByLabel('Hire date'), '2026-10-05');
  for (const [label, option] of [['Country', 'Germany'], ['Department', 'Engineering'], ['Role', 'Software Engineer'], ['Level', 'L3']]) {
    await tabTo(page, page.getByRole('combobox', { name: label }));
    await chooseWithKeys(page, option!);
    await expect(page.getByRole('combobox', { name: label })).toHaveValue(option!);
  }
  await tabTo(page, page.getByLabel('Salary'));
  await page.keyboard.type('72000');
  const newCode = await code.inputValue();
  await tabTo(page, page.getByRole('button', { name: 'Add employee' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`/employees/${newCode}`);
  await expect(page.getByRole('heading', { name: 'Keyboard Tester' })).toBeVisible();
});

test('keyboard: make a job change', async ({ page }) => {
  await page.goto('/employees/E000010');
  await tabTo(page, page.getByRole('button', { name: 'Change job or pay' }));
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Change job or pay' });
  await typeDate(page, dialog.getByLabel('Effective date'), '2026-11-01');
  await tabTo(page, dialog.getByLabel('Salary'));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('999000');
  await tabTo(page, dialog.getByRole('button', { name: 'Save change' }));
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('list', { name: 'History' }).getByRole('listitem').first()).toContainText('Scheduled');
});

test('keyboard: leave and undo', async ({ page }) => {
  await page.goto('/employees/E000020');
  await tabTo(page, page.getByRole('button', { name: 'Mark as leaving' }));
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Mark as leaving' });
  await typeDate(page, dialog.getByLabel('Leave date'), '2026-12-31');
  await tabTo(page, dialog.getByRole('button', { name: 'Save' }));
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  const undo = page.getByRole('button', { name: 'Undo leaving' });
  await tabTo(page, undo);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Mark as leaving' })).toBeVisible();
});

test('keyboard: import a CSV', async ({ page }) => {
  await page.goto('/import');
  const picker = page.getByLabel('CSV file');
  await tabTo(page, picker);
  await picker.setInputFiles({
    name: 'one.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('code,first_name,last_name,gender,work_email,country,department,role,level,salary,hire_date\n'
      + 'E090100,Kei,Board,female,kei.board@acme.example,JP,Finance,Accountant,2,6100000,2026-10-01\n'),
  });
  await expect(page.getByText('1 row ready to import, no problems.')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Import 1 employee' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Imported 1 employee.');
});

test('keyboard: ask a question', async ({ page }) => {
  await page.goto('/assistant');
  await tabTo(page, page.getByRole('button', { name: 'New chat' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/assistant\/\d+$/);
  await tabTo(page, page.getByLabel('Your question'));
  await page.keyboard.type('Who are the engineers in Brazil?');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Answer finished.');
  await expect(page.getByRole('article', { name: 'Answer' })).toContainText('Here are the engineers in Brazil.');
});

// A11Y-3
test('focus is visible, skip link works, errors are announced', async ({ page }) => {
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible(); // the page is drawn after the session check
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  const look = (el: Element) => {
    const s = getComputedStyle(el);
    return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} | ${s.boxShadow} | ${s.borderColor}`;
  };
  for (const target of [page.getByRole('link', { name: 'Export CSV' }), page.getByLabel('Search'), page.getByRole('columnheader', { name: 'Name' }).getByRole('button')]) {
    const before = await target.evaluate(look);
    await tabTo(page, target);
    await expect.poll(() => target.evaluate(look), `focus shows on ${target}`).not.toBe(before); // borders change over a short transition
  }

  await page.goto('/employees/new');
  await tabTo(page, page.getByRole('button', { name: 'Add employee' }));
  await page.keyboard.press('Enter');
  const first = page.getByLabel('First name');
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(first).toHaveAccessibleDescription('Enter a first name.');
});
