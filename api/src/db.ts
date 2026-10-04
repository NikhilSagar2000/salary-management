import pg from 'pg';

// DATE columns stay 'YYYY-MM-DD' strings; pg's default turns them into local-midnight Dates,
// which shift by a day depending on the server's timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// bigint (salaries, counts) as JS numbers: salaries are capped at 10,000,000,000, far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

export const createPool = (connectionString: string) => new pg.Pool({ connectionString });
