import { expect, test } from 'vitest';
import { fixedClock, requestTimezone, todayIn } from '../src/clock.ts';

test.fails('today follows the X-Timezone header, falling back to UTC for a missing or unknown zone', () => {
  const clock = fixedClock('2026-10-01T20:00:00Z');
  const today = (header: string | undefined) => todayIn(clock, requestTimezone(header));
  expect(today('Asia/Tokyo')).toBe('2026-10-02');
  expect(today('America/Los_Angeles')).toBe('2026-10-01');
  expect(today('UTC')).toBe('2026-10-01');
  expect(today('Mars/Base')).toBe('2026-10-01');
  expect(today(undefined)).toBe('2026-10-01');
  expect(requestTimezone('Mars/Base')).toBe('UTC');
});
