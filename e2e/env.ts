// Values for the end-to-end run only. None of them is a real secret; the secrets test checks the web bundle holds none of them.
export const E2E_PORT = 4733;
export const E2E_PASSWORD = 'e2e only, not a real password';
export const E2E_MODEL_KEY = 'e2e-fake-openrouter-key';
export const ADMIN_DATABASE_URL = process.env.E2E_ADMIN_DATABASE_URL ?? 'postgres://acme:acme@localhost:4734/acme';
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://acme:acme@localhost:4734/acme_e2e';
export const AUTH_STATE = new URL('./.auth/hr.json', import.meta.url).pathname;
export const WEB_DIST = new URL('../web/dist/', import.meta.url).pathname;
