import { expect, test } from 'vitest';
import { formatDate, formatMoney } from '../src/format.ts';

test.fails('money shows currency code and separators; dates like 4 Oct 2026', () => {
  expect(formatMoney(128000, 'USD')).toBe('USD 128,000');
  expect(formatMoney(1550000, 'INR')).toBe('INR 1,550,000');
  expect(formatMoney(6070000, 'JPY')).toBe('JPY 6,070,000');
  expect(formatMoney(950, 'EUR')).toBe('EUR 950');
  const original = process.env.TZ;
  try {
    for (const tz of ['America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      expect(formatDate('2026-10-04')).toBe('4 Oct 2026');
      expect(formatDate('2012-01-01')).toBe('1 Jan 2012');
    }
  } finally {
    process.env.TZ = original;
  }
});
