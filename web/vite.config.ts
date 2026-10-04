import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 4731, strictPort: true, proxy: { '/api': 'http://localhost:4732' } },
  // Mantine under jsdom plus simulated typing is slow; 15 s per test.
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false, passWithNoTests: true, testTimeout: 15_000 },
});
