import { expect, test } from 'vitest';
import { testPool } from './helpers.ts';

// Its own file: Node prints each deprecation once per process, so an earlier pool would hide it.
test('test connections start with the 60 s statement timeout, without racing the first query', async () => {
  const warnings: string[] = [];
  const onWarning = (w: Error) => warnings.push(w.message);
  process.on('warning', onWarning);
  try {
    const pool = testPool();
    const results = await Promise.all([1, 2, 3].map(() => pool.query('SHOW statement_timeout')));
    await new Promise((resolve) => setImmediate(resolve));
    expect(results.map((r) => r.rows[0].statement_timeout)).toEqual(['1min', '1min', '1min']);
    expect(warnings).toEqual([]);
  } finally {
    process.off('warning', onWarning);
  }
});
