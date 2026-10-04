/** Tests must never reach the real model (AST-18): refuse OpenRouter's real address. */
export function assertFakeModel(env: Record<string, string | undefined>): void {
  const url = env.OPENROUTER_BASE_URL ?? '';
  if (/openrouter\.ai/i.test(url)) {
    throw new Error(`Tests must not call the real OpenRouter (OPENROUTER_BASE_URL=${url}). Point it at the fake model.`);
  }
}
