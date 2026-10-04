import pg from 'pg';

// DATE columns stay 'YYYY-MM-DD' strings; pg's default turns them into local-midnight Dates,
// which shift by a day depending on the server's timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// bigint (salaries, counts) as JS numbers: salaries are capped at 10,000,000,000, far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

export const createPool = (connectionString: string) => new pg.Pool({ connectionString });

/** Runs `fn` in one transaction: commits if it resolves, rolls back if it throws. */
export async function withTx<T>(db: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
