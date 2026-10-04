// npm run seed [-- --reset]: loads the 10,000-person seed into DATABASE_URL.
import { createPool } from '../db.ts';
import { migrate } from '../migrate.ts';
import { generateSeed } from './generate.ts';
import { writeSeed } from './write.ts';

const db = createPool(process.env.DATABASE_URL ?? 'postgres://acme:acme@localhost:4734/acme');
await migrate(db);
const existing = (await db.query('SELECT count(*) AS n FROM employees')).rows[0].n as number;
if (existing > 0 && !process.argv.includes('--reset')) {
  console.error(`The database already has ${existing} employees. Run "npm run seed -- --reset" to replace them.`);
  process.exit(1);
}
if (existing > 0) await db.query('TRUNCATE employees, job_changes, leave_events RESTART IDENTITY CASCADE');
const t0 = performance.now();
const seed = generateSeed();
const t1 = performance.now();
await writeSeed(db, seed);
const t2 = performance.now();
console.log(
  `Seeded ${seed.employees.length} employees, ${seed.changes.length} job changes, ${seed.leaveEvents.length} leavers, ` +
    `${seed.outliers.length} outliers. Generate ${Math.round(t1 - t0)} ms, write ${Math.round(t2 - t1)} ms.`,
);
await db.end();
