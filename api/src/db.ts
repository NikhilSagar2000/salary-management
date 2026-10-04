import pg from 'pg';

// DATE columns stay 'YYYY-MM-DD' strings; pg's default turns them into local-midnight Dates,
// which shift by a day depending on the server's timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const createPool = (connectionString: string) => new pg.Pool({ connectionString });
