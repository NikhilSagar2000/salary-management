import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ponytail: one shared test database, so files run one at a time; per-file schemas if the suite gets slow
    fileParallelism: false,
    passWithNoTests: true,
    setupFiles: ['./test/setup.ts'],
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://acme:acme@localhost:4734/acme_test',
    },
  },
});
