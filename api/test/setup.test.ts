import { expect, test } from 'vitest';
import { assertFakeModel } from './guard.ts';

test("test set-up refuses OpenRouter's real base URL", () => {
  expect(() => assertFakeModel({ OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1' })).toThrow(/real OpenRouter/);
  expect(() => assertFakeModel({ OPENROUTER_BASE_URL: 'https://OpenRouter.ai/api/v1' })).toThrow(/real OpenRouter/);
  expect(() => assertFakeModel({ OPENROUTER_BASE_URL: 'http://127.0.0.1:4799/v1' })).not.toThrow();
  expect(() => assertFakeModel({})).not.toThrow();
});
