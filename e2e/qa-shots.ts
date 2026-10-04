// Manual QA, phase 6: screenshots of each screen at a given width and colour scheme, for looking at by eye.
// Run against the end-to-end server: `node e2e/qa-shots.ts <outDir> <width> <light|dark> [path ...]`.
import { chromium } from '@playwright/test';
import { E2E_PASSWORD, E2E_PORT } from './env.ts';

const [outDir, width = '390', scheme = 'light', ...paths] = process.argv.slice(2);
const base = `http://localhost:${E2E_PORT}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 844 }, colorScheme: scheme as 'light' | 'dark', baseURL: base });
await page.goto('/signin');
await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/employees');
for (const path of paths) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  const file = `${outDir}/${width}-${scheme}-${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${path}: ${file} (scrollWidth ${scrollWidth} / ${innerWidth})`);
}
await browser.close();
