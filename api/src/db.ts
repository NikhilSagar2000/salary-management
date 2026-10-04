import pg from 'pg';

// DATE columns stay 'YYYY-MM-DD' strings; pg's default turns them into local-midnight Dates,
// which shift by a day depending on the server's timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// bigint (salaries, counts) as JS numbers: salaries are capped at 10,000,000,000, far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

/** The local Docker database, used when DATABASE_URL isn't set. */
export const DEV_DATABASE_URL = 'postgres://acme:acme@localhost:4734/acme';

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

/** Anything that can run a query: the pool or one client inside a transaction. */
export type Db = Pick<pg.Pool, 'query'>;

/** Runs `fn` in a READ ONLY transaction (rolled back at the end): Postgres refuses any write inside it. */
export async function readOnlyTx<T>(db: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN READ ONLY');
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
